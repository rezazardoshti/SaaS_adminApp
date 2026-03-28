"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMyMemberships } from "@/services/api/employees";
import {
  createDocument,
  formatDocumentDate,
  formatDocumentFileSize,
  getDocuments,
  updateDocument,
  type DocumentCategory,
  type DocumentCreatePayload,
  type DocumentItem,
  type DocumentUpdatePayload,
  type DocumentVisibility,
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

type DocumentFormState = {
  title: string;
  description: string;
  file: File | null;
};

const FIXED_EMPLOYEE_CATEGORY: DocumentCategory = "general";
const FIXED_EMPLOYEE_VISIBILITY: DocumentVisibility = "company_admin";

const INITIAL_FORM: DocumentFormState = {
  title: "",
  description: "",
  file: null,
};

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

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
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{helper}</div>
    </div>
  );
}

function MessageBox({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {text}
    </div>
  );
}

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

export default function WorkspaceDocumentsPage() {
  const { user, membership, company, access: authAccess } = useAuth();
  const access = getSafeAccessToken(authAccess);
  const membershipFromContext = membership as MembershipWithDocument | null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [resolvedMembership, setResolvedMembership] = useState<MembershipWithDocument | null>(
    membershipFromContext
  );

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState<DocumentFormState>(INITIAL_FORM);
  const [editingItem, setEditingItem] = useState<DocumentItem | null>(null);

  const [search, setSearch] = useState("");

  const membershipData = resolvedMembership || membershipFromContext;

  const displayName = useMemo(() => {
    return (
      user?.full_name?.trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      user?.email ||
      "User"
    );
  }, [user]);

  const companyName = company?.company_name || membershipData?.company_name || "-";
  const employeeNumber = membershipData?.employee_number || "-";

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((item) => {
      if (!query) return true;

      return [
        item.public_id,
        item.title,
        item.description,
        item.original_filename,
        item.employee_full_name,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [documents, search]);

  const stats = useMemo(() => {
    const total = documents.length;
    const totalSize = documents.reduce((sum, item) => sum + Number(item.file_size || 0), 0);
    const thisMonth = documents.filter((item) => {
      if (!item.created_at) return false;
      const created = new Date(item.created_at);
      const now = new Date();
      return (
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth()
      );
    }).length;

    return {
      total: String(total),
      totalSize: formatDocumentFileSize(totalSize),
      thisMonth: String(thisMonth),
    };
  }, [documents]);

  const loadDocuments = useCallback(
    async (showLoader = true) => {
      if (!access) {
        setLoading(false);
        return;
      }

      try {
        if (showLoader) setLoading(true);
        setErrorMessage("");

        let activeMembership = membershipData;

        if (!activeMembership?.company || !activeMembership?.id) {
          const memberships = (await getMyMemberships(access)) as MembershipWithDocument[];
          activeMembership = memberships.find((item) => item.is_active) || memberships[0] || null;
          setResolvedMembership(activeMembership);
        }

        if (!activeMembership?.company || !activeMembership?.id) {
          throw new Error("Company or employee membership is missing for this account.");
        }

        const docs = await getDocuments({
          company: activeMembership.company,
          employee_membership: activeMembership.id,
          mine: true,
        });

        setDocuments(Array.isArray(docs) ? docs : []);
      } catch (error) {
        setErrorMessage(parseApiError(error, "Documents could not be loaded."));
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [access, membershipData]
  );

  useEffect(() => {
    loadDocuments(true);
  }, [loadDocuments]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (successMessage || errorMessage) {
      timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 6000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [successMessage, errorMessage]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingItem(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleStartEdit(item: DocumentItem) {
    setEditingItem(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      file: null,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveDocument(e: React.FormEvent) {
    e.preventDefault();

    if (!membershipData?.company || !membershipData?.id) {
      setErrorMessage("Company or employee membership is missing for this account.");
      return;
    }

    if (!form.title.trim()) {
      setErrorMessage("Bitte einen Betreff eingeben.");
      return;
    }

    if (!editingItem && !form.file) {
      setErrorMessage("Bitte eine Datei auswählen.");
      return;
    }

    try {
      setActionLoading(editingItem ? "update" : "create");
      setSuccessMessage("");
      setErrorMessage("");

      if (editingItem) {
        const payload: DocumentUpdatePayload = {
          company: membershipData.company,
          employee_membership: membershipData.id,
          title: form.title.trim(),
          description: form.description.trim(),
          category: FIXED_EMPLOYEE_CATEGORY,
          visibility: FIXED_EMPLOYEE_VISIBILITY,
        };

        if (form.file) {
          payload.file = form.file;
        }

        await updateDocument(editingItem.id, payload);
        setSuccessMessage("Dokument erfolgreich aktualisiert.");
      } else {
        const payload: DocumentCreatePayload = {
          company: membershipData.company,
          employee_membership: membershipData.id,
          title: form.title.trim(),
          description: form.description.trim(),
          category: FIXED_EMPLOYEE_CATEGORY,
          visibility: FIXED_EMPLOYEE_VISIBILITY,
          file: form.file as File,
        };

        await createDocument(payload);
        setSuccessMessage("Dokument erfolgreich hochgeladen.");
      }

      resetForm();
      await loadDocuments(false);
    } catch (error) {
      setErrorMessage(parseApiError(error, "Dokument konnte nicht gespeichert werden."));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Loading documents workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-3xl bg-slate-900 px-6 py-7 text-white shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-slate-300">Documents workspace</div>
              <h1 className="mt-2 text-3xl font-semibold">{displayName}</h1>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
                <span>Company: {companyName}</span>
                <span>Employee No: {employeeNumber}</span>
                <span>Only your own files for your company</span>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none lg:w-72"
              />
            </div>
          </div>
        </div>

        {successMessage ? <MessageBox type="success" text={successMessage} /> : null}
        {errorMessage ? <MessageBox type="error" text={errorMessage} /> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
  title="My documents"
  value={stats.total}
  helper="Alle Dokumente, die du bisher hochgeladen hast."
/>
<StatCard
  title="Uploaded this month"
  value={stats.thisMonth}
  helper="Dokumente, die im aktuellen Monat hinzugefügt wurden."
/>
<StatCard
  title="Storage used"
  value={stats.totalSize}
  helper="Gesamte Dateigröße deiner hochgeladenen Unterlagen."
/>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
          <SectionCard
            title={editingItem ? "Dokument bearbeiten" : "Dokument hochladen"}
            subtitle="Einfacher Upload für deine eigenen Unterlagen."
          >
            <form onSubmit={handleSaveDocument} className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Betreff</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Zum Beispiel: Krankmeldung, Vertrag, Rechnung"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Beschreibung
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optionale Notiz zu diesem Dokument"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {editingItem ? "Datei ersetzen (optional)" : "Datei"}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      file: e.target.files?.[0] || null,
                    }))
                  }
                  className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
                />
                {form.file ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Selected: {form.file.name}
                  </p>
                ) : null}
                {editingItem?.original_filename ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Current file: {editingItem.original_filename}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                This upload is automatically assigned to your company and your own employee profile.
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={actionLoading === "create" || actionLoading === "update"}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading === "create" || actionLoading === "update"
                    ? "Saving..."
                    : editingItem
                    ? "Änderungen speichern"
                    : "Dokument hochladen"}
                </button>

                {editingItem ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Bearbeiten abbrechen
                  </button>
                ) : null}
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Meine Dokumente" subtitle="Deine persönliche Dokumentenübersicht">
            {filteredDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                No documents found.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredDocuments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="text-base font-semibold text-slate-900">
                          {item.title}
                        </div>

                        <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <span className="font-medium text-slate-800">Document ID:</span>{" "}
                            {item.public_id || "-"}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">Filename:</span>{" "}
                            {item.original_filename || "-"}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">Size:</span>{" "}
                            {formatDocumentFileSize(item.file_size)}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">Type:</span>{" "}
                            {item.mime_type || "-"}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">Uploaded:</span>{" "}
                            {formatDocumentDate(item.created_at)}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">Assigned to:</span>{" "}
                            {item.employee_full_name || displayName}
                          </div>
                        </div>

                        {item.description ? (
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            {item.description}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
                        {item.file || item.file_url ? (
                          <a
                            href={item.file_url || item.file || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
                          >
                            Open file
                          </a>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}