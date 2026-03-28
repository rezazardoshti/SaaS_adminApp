"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PersonnelSubnav from "@/components/dashboard/PersonnelSubnav";
import { useAuth } from "@/context/AuthContext";
import { getMyMemberships } from "@/services/api/employees";
import {
  formatDocumentDate,
  formatDocumentFileSize,
  getDocuments,
  type DocumentItem,
} from "@/services/api/documents";

type MembershipWithDocument = {
  id: number;
  role: "owner" | "admin" | "employee";
  company: number;
  company_public_id?: string;
  company_name?: string;
  employee_number?: string | null;
  department?: string | null;
  is_active: boolean;
};

const PAGE_SIZE = 50;

/* ---------------- helpers ---------------- */

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

  if (error instanceof Error && error.message.trim()) return error.message;
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

function isWithinDateRange(
  createdAt?: string,
  fromDate?: string,
  toDate?: string
): boolean {
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    if (created < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`);
    if (created > to) return false;
  }

  return true;
}

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, totalPages - 1, totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 2, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 2, currentPage - 1, currentPage, currentPage + 1, totalPages - 1, totalPages];
}

/* ---------------- ui ---------------- */

function StatCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{helper}</div>
    </div>
  );
}

function MessageBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {text}
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
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
      <div className="text-sm text-slate-500">
        Page {currentPage} / {totalPages}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        {pages.map((page, index) => {
          const showEllipsis =
            index > 0 && page - pages[index - 1] > 1;

          return (
            <React.Fragment key={page}>
              {showEllipsis ? (
                <span className="px-1 text-sm text-slate-400">...</span>
              ) : null}

              <button
                type="button"
                onClick={() => onPageChange(page)}
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  currentPage === page
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            </React.Fragment>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-slate-900">
              {item.title || "Document details"}
            </h2>
            <p className="text-sm text-slate-500">{item.public_id}</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="max-h-[80vh] space-y-6 overflow-y-auto p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Document information
            </div>

            <div className="grid gap-4">
              <DetailRow label="Title" value={item.title || "-"} />
              <DetailRow label="Employee" value={item.employee_full_name || "-"} />
              <DetailRow label="Uploaded by" value={item.uploaded_by_name || "-"} />
              <DetailRow label="Category" value={getCategoryLabel(item.category)} />
              <DetailRow label="Visibility" value={getVisibilityLabel(item.visibility)} />
              <DetailRow label="Created" value={formatDocumentDate(item.created_at)} />
              <DetailRow
                label="File name"
                value={<span className="break-all">{item.original_filename || "-"}</span>}
              />
              <DetailRow label="Size" value={formatDocumentFileSize(item.file_size)} />
              <DetailRow label="Type" value={item.mime_type || "-"} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Message
            </div>

            <div className="max-h-72 overflow-y-auto rounded-2xl bg-slate-100 p-4">
              <p className="break-all whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {item.description || "No message"}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              File
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="break-all text-sm font-medium text-slate-900">
                  {item.original_filename || "No file name"}
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.mime_type || "-"}</div>
              </div>

              {fileHref ? (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={fileHref}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white"
                  >
                    Open
                  </a>

                  <a
                    href={fileHref}
                    download
                    className="rounded-xl border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Download
                  </a>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No file available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function DashboardDocumentsPage() {
  const { membership, company, access: authAccess } = useAuth();
  const access = getSafeAccessToken(authAccess);
  const membershipFromContext = membership as MembershipWithDocument | null;

  const [resolvedMembership, setResolvedMembership] = useState<MembershipWithDocument | null>(
    membershipFromContext
  );
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DocumentItem | null>(null);

  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const membershipData = resolvedMembership || membershipFromContext;
  const companyName = company?.company_name || membershipData?.company_name || "-";

  const isAdminRole =
    membershipData?.role === "owner" || membershipData?.role === "admin";

  const loadDocuments = useCallback(async () => {
    if (!access) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      let activeMembership = membershipData;
      let companyId = company?.id ?? null;

      if (!activeMembership?.id) {
        const memberships = (await getMyMemberships(access)) as MembershipWithDocument[];
        activeMembership = memberships.find((m) => m.is_active) || memberships[0] || null;
        setResolvedMembership(activeMembership);
      }

      const allowed =
        activeMembership?.role === "owner" || activeMembership?.role === "admin";

      if (!allowed) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      if (!companyId && activeMembership?.company) {
        companyId = activeMembership.company;
      }

      if (!companyId) {
        throw new Error("Company missing.");
      }

      const data = await getDocuments({ company: companyId });
      setDocuments(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(parseApiError(e, "Error loading documents."));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [access, company?.id, membershipData]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const employeeOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        documents
          .map((item) => (item.employee_full_name || "").trim())
          .filter(Boolean)
      )
    );

    return names.sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const employeeQuery = employeeFilter.trim().toLowerCase();

    return documents.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.public_id,
          item.title,
          item.description,
          item.original_filename,
          item.employee_full_name,
          item.employee_email,
          item.uploaded_by_name,
        ]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(query));

      const matchesEmployee =
        !employeeQuery ||
        String(item.employee_full_name ?? "")
          .toLowerCase()
          .includes(employeeQuery);

      const matchesDate = isWithinDateRange(item.created_at, dateFrom, dateTo);

      return matchesSearch && matchesEmployee && matchesDate;
    });
  }, [documents, search, employeeFilter, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, employeeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDocuments.slice(start, start + PAGE_SIZE);
  }, [filteredDocuments, currentPage]);

  const uploadedThisMonth = useMemo(() => {
    const now = new Date();

    return documents.filter((item) => {
      if (!item.created_at) return false;
      const created = new Date(item.created_at);
      if (Number.isNaN(created.getTime())) return false;

      return (
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth()
      );
    }).length;
  }, [documents]);

  if (!loading && !isAdminRole) {
    return (
      <div className="space-y-6">
        <PersonnelSubnav />

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Access denied</h1>
          <p className="mt-2 text-sm text-slate-600">
            This area is only available for company admins and owners.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PersonnelSubnav />

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Company documents</h1>
        <p className="mt-1 text-sm text-slate-500">Company: {companyName}</p>
      </div>

      {error ? <MessageBox text={error} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="Documents"
          value={String(documents.length)}
          helper="Alle Dokumente dieser Firma"
        />
        <StatCard
          title="This month"
          value={String(uploadedThisMonth)}
          helper="Uploads im aktuellen Monat"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <p className="mt-1 text-sm text-slate-500">
            Suche nach Text, Mitarbeitername oder Zeitraum.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, message, file, employee..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Employee name
            </label>
            <input
              list="employee-name-options"
              type="text"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Filter by employee"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            />
            <datalist id="employee-name-options">
              {employeeOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Date from
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Date to
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <div className="text-sm text-slate-500">
            {filteredDocuments.length} results
          </div>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setEmployeeFilter("");
              setDateFrom("");
              setDateTo("");
              setCurrentPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4 text-sm text-slate-500">
          Showing{" "}
          <span className="font-medium text-slate-700">
            {filteredDocuments.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
          </span>
          {" - "}
          <span className="font-medium text-slate-700">
            {Math.min(currentPage * PAGE_SIZE, filteredDocuments.length)}
          </span>
          {" of "}
          <span className="font-medium text-slate-700">{filteredDocuments.length}</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No documents found.</div>
        ) : (
          <div className="divide-y">
            {paginatedDocuments.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 p-5 hover:bg-slate-50"
              >
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <div className="break-words text-base font-semibold text-slate-900">
                      {item.title || "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.public_id}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelected(item)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
                  >
                    View
                  </button>
                </div>

                <div className="max-h-24 overflow-y-auto rounded-2xl bg-slate-100 p-3">
                  <p className="break-all whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {item.description || "-"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>{item.employee_full_name || "-"}</span>
                  <span>{getCategoryLabel(item.category)}</span>
                  <span>{getVisibilityLabel(item.visibility)}</span>
                  <span>{formatDocumentDate(item.created_at)}</span>
                  <span>{formatDocumentFileSize(item.file_size)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            if (page < 1 || page > totalPages) return;
            setCurrentPage(page);
          }}
        />
      </div>

      <DocumentModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}