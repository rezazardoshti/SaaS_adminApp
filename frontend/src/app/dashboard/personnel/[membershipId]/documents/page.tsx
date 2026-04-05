"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { getMyMemberships } from "@/services/api/employees";
import {
  formatDocumentDate,
  formatDocumentFileSize,
  getDocuments,
  type DocumentItem,
} from "@/services/api/documents";

type MembershipItem = {
  id: number;
  role: "owner" | "admin" | "employee";
  company: number;
  is_active: boolean;
};

function getSafeAccessToken(access?: string | null) {
  if (access && access.trim()) return access;

  if (typeof window !== "undefined") {
    const fallback =
      localStorage.getItem("access") ||
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("access") ||
      sessionStorage.getItem("accessToken");

    if (fallback && fallback.trim()) return fallback;
  }

  return "";
}

function parseApiError(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;

    if (typeof maybeError.detail === "string") return maybeError.detail;
    if (typeof maybeError.message === "string") return maybeError.message;

    for (const value of Object.values(maybeError)) {
      if (typeof value === "string" && value.trim()) return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function getCategoryLabel(value?: string | null) {
  switch (value) {
    case "general":
      return "General";
    case "invoice":
      return "Invoice";
    case "receipt":
      return "Receipt";
    case "contract":
      return "Contract";
    case "sick_note":
      return "Sick note";
    case "vacation_attachment":
      return "Vacation attachment";
    case "other":
      return "Other";
    default:
      return value || "-";
  }
}

function getVisibilityLabel(value?: string | null) {
  switch (value) {
    case "private":
      return "Private";
    case "company_admin":
      return "Company admin";
    case "company_all":
      return "Company all";
    default:
      return value || "-";
  }
}

function InfoCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-slate-100 py-3 last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{value}</div>
    </div>
  );
}

function DocumentModal({
  item,
  onClose,
}: {
  item: DocumentItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const fileHref = item.file_url || item.file || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {item.title || "Document details"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{item.public_id || "-"}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <DetailRow label="Title" value={item.title || "-"} />
          <DetailRow label="Category" value={getCategoryLabel(item.category)} />
          <DetailRow
            label="Visibility"
            value={getVisibilityLabel(item.visibility)}
          />
          <DetailRow label="Created" value={formatDocumentDate(item.created_at)} />
          <DetailRow
            label="File size"
            value={formatDocumentFileSize(item.file_size)}
          />
          <DetailRow
            label="Employee"
            value={item.employee_full_name || item.employee_email || "-"}
          />
          <DetailRow
            label="Message"
            value={
              item.description ||
              (item as { message?: string | null }).message ||
              (item as { note?: string | null }).note ||
              "No message"
            }
          />
          <DetailRow
            label="File"
            value={
              <div className="space-y-1">
                <div>{item.original_filename || "No file name"}</div>
                <div className="text-slate-500">{item.mime_type || "-"}</div>
                {fileHref ? (
                  <a
                    href={fileHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    Open file
                  </a>
                ) : (
                  <span className="text-slate-500">No file available</span>
                )}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

function matchesMembership(item: DocumentItem, membershipId: string): boolean {
  const target = String(membershipId);

  const candidates = [
    (item as { employee_membership?: number | string | null }).employee_membership,
    (item as { employee_membership_id?: number | string | null }).employee_membership_id,
    (item as { membership?: number | string | null }).membership,
    (item as { membership_id?: number | string | null }).membership_id,
    (item as { employee_membership_public_id?: string | null }).employee_membership_public_id,
  ];

  return candidates.some((value) => String(value ?? "") === target);
}

export default function EmployeeDocumentsPage() {
  const { company, access: authAccess } = useAuth();
  const params = useParams();

  const membershipId = Array.isArray(params?.membershipId)
    ? params.membershipId[0]
    : params?.membershipId;

  const access = getSafeAccessToken(authAccess);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [search, setSearch] = useState("");

  const loadDocuments = useCallback(async () => {
    if (!access) {
      setLoading(false);
      return;
    }

    if (!membershipId || typeof membershipId !== "string") {
      setPageError("Invalid employee membership ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setPageError("");

      let companyId = company?.id ?? null;

      if (!companyId) {
        const memberships = (await getMyMemberships(access)) as MembershipItem[];
        const activeMembership =
          memberships.find((item) => item.is_active) || memberships[0];

        if (!activeMembership?.company) {
          throw new Error("Company missing.");
        }

        companyId = activeMembership.company;
      }

      const data = await getDocuments({ company: companyId });
      const allDocuments = Array.isArray(data) ? data : [];

      setDocuments(
        allDocuments.filter((item) => matchesMembership(item, membershipId))
      );
    } catch (error) {
      setPageError(parseApiError(error, "Error loading employee documents."));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [access, company?.id, membershipId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return documents;

    return documents.filter((item) =>
      [
        item.public_id,
        item.title,
        item.description,
        (item as { message?: string | null }).message,
        (item as { note?: string | null }).note,
        item.original_filename,
        item.employee_full_name,
        item.employee_email,
        item.uploaded_by_name,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(query))
    );
  }, [documents, search]);

  const stats = useMemo(() => {
    const total = documents.length;

    const uploadedThisMonth = documents.filter((item) => {
      if (!item.created_at) return false;

      const created = new Date(item.created_at);
      const now = new Date();

      if (Number.isNaN(created.getTime())) return false;

      return (
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth()
      );
    }).length;

    const withFiles = documents.filter(
      (item) => !!(item.file_url || item.file)
    ).length;

    return { total, uploadedThisMonth, withFiles };
  }, [documents]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Employee documents
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Documents overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Here you can review all documents that belong to the selected
              employee.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadDocuments();
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Documents" value={stats.total} helper="All loaded items" />
        <InfoCard
          label="Uploaded this month"
          value={stats.uploadedThisMonth}
          helper="Created in current month"
        />
        <InfoCard
          label="With file"
          value={stats.withFiles}
          helper="Documents with available file"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Search
        </label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Title, message, file..."
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
        />
      </section>

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading documents...</p>
        </section>
      ) : pageError ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-800">
            Documents could not be loaded
          </h2>
          <p className="mt-2 text-sm text-red-700">{pageError}</p>
        </section>
      ) : filteredDocuments.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            No documents are available for this employee.
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {filteredDocuments.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-slate-900">
                    {item.title || "-"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.public_id || "-"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.description ||
                      (item as { message?: string | null }).message ||
                      (item as { note?: string | null }).note ||
                      "-"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  View
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {getCategoryLabel(item.category)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {getVisibilityLabel(item.visibility)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {formatDocumentDate(item.created_at)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {formatDocumentFileSize(item.file_size)}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}

      <DocumentModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}