"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PersonnelSubnav from "@/components/dashboard/PersonnelSubnav";
import { useAuth } from "@/context/AuthContext";
import {
  getEmployees,
  getMyMemberships,
  type EmployeeMembershipItem,
} from "@/services/api/employees";
import {
  createDocument,
  deleteDocument,
  formatDocumentDate,
  formatDocumentFileSize,
  getDocumentCategoryLabel,
  getDocuments,
  getDocumentVisibilityLabel,
  updateDocument,
  type DocumentCategory,
  type DocumentCreatePayload,
  type DocumentItem,
  type DocumentUpdatePayload,
  type DocumentVisibility,
} from "@/services/api/documents";

type FlashMessage = {
  type: "success" | "error";
  text: string;
} | null;

type ActiveMembership = {
  id: number;
  company: number;
  role: "owner" | "admin" | "employee";
  company_name?: string;
  is_active?: boolean;
};

type DocumentFormState = {
  title: string;
  description: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  employee_membership: string;
  file: File | null;
};

const INITIAL_FORM: DocumentFormState = {
  title: "",
  description: "",
  category: "general",
  visibility: "company_admin",
  employee_membership: "",
  file: null,
};

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{helper}</div>
    </div>
  );
}

function getAccessToken(access?: string | null) {
  if (access && access.trim()) return access;

  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("access") ||
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("access") ||
      sessionStorage.getItem("accessToken") ||
      ""
    );
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

function getCategoryTone(category?: string | null) {
  switch (category) {
    case "contract":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "invoice":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "receipt":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "sick_note":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "vacation_attachment":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getVisibilityTone(visibility?: string | null) {
  switch (visibility) {
    case "private":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "company_admin":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "company_all":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getEmployeeFullName(employee?: EmployeeMembershipItem | null) {
  if (!employee) return "-";

  return (
    employee.user?.full_name ||
    [employee.user?.first_name, employee.user?.last_name].filter(Boolean).join(" ").trim() ||
    employee.user?.email ||
    "-"
  );
}

export default function PersonnelDocumentsPage() {
  const { access: authAccess } = useAuth();
  const access = getAccessToken(authAccess);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [flash, setFlash] = useState<FlashMessage>(null);
  const [pageError, setPageError] = useState("");

  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [employees, setEmployees] = useState<EmployeeMembershipItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"" | DocumentCategory>("");
  const [visibilityFilter, setVisibilityFilter] = useState<"" | DocumentVisibility>("");

  const [form, setForm] = useState<DocumentFormState>(INITIAL_FORM);
  const [editingItem, setEditingItem] = useState<DocumentItem | null>(null);

  const canManage = useMemo(() => {
    const role = activeMembership?.role;
    return role === "owner" || role === "admin";
  }, [activeMembership]);

  const employeeMap = useMemo(() => {
    const map = new Map<number, EmployeeMembershipItem>();
    employees.forEach((item) => {
      map.set(Number(item.id), item);
    });
    return map;
  }, [employees]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((item) => {
      const employeeMatches = employeeFilter
        ? String(item.employee_membership ?? "") === employeeFilter
        : true;

      const categoryMatches = categoryFilter ? item.category === categoryFilter : true;
      const visibilityMatches = visibilityFilter ? item.visibility === visibilityFilter : true;

      const employee = item.employee_membership
        ? employeeMap.get(Number(item.employee_membership))
        : null;
      const employeeName =
        getEmployeeFullName(employee) ||
        item.employee_full_name ||
        "-";
      const employeeNumber = employee?.employee_number || "-";

      const searchMatches = !query
        ? true
        : [
            item.public_id,
            item.title,
            item.description,
            item.original_filename,
            item.employee_full_name,
            employeeName,
            employeeNumber,
            item.uploaded_by_name,
          ]
            .map((value) => String(value ?? "").toLowerCase())
            .some((value) => value.includes(query));

      return employeeMatches && categoryMatches && visibilityMatches && searchMatches;
    });
  }, [documents, search, employeeFilter, categoryFilter, visibilityFilter, employeeMap]);

  const stats = useMemo(() => {
    const total = documents.length;
    const privateCount = documents.filter((item) => item.visibility === "private").length;
    const adminCount = documents.filter((item) => item.visibility === "company_admin").length;
    const allCount = documents.filter((item) => item.visibility === "company_all").length;

    return {
      total: String(total),
      privateCount: String(privateCount),
      adminCount: String(adminCount),
      allCount: String(allCount),
    };
  }, [documents]);

  const loadData = useCallback(
    async (withLoader = true) => {
      if (!access) return;

      try {
        if (withLoader) setLoading(true);
        else setRefreshing(true);

        setPageError("");

        const myMemberships = await getMyMemberships(access);
        const currentMembership =
          myMemberships.find((item: ActiveMembership) => item.is_active) || myMemberships[0];

        if (!currentMembership?.company) {
          throw new Error("No active company membership found.");
        }

        setActiveMembership(currentMembership);

        const companyId = currentMembership.company;

        const [employeeItems, documentItems] = await Promise.all([
          getEmployees({
            token: access,
            companyId,
          }),
          getDocuments({
            company: companyId,
          }),
        ]);

        setEmployees(employeeItems);
        setDocuments(Array.isArray(documentItems) ? documentItems : []);
      } catch (error) {
        setPageError(parseApiError(error, "Documents could not be loaded."));
      } finally {
        if (withLoader) setLoading(false);
        else setRefreshing(false);
      }
    },
    [access]
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingItem(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function startEdit(item: DocumentItem) {
    setEditingItem(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      category: (item.category || "general") as DocumentCategory,
      visibility: (item.visibility || "company_admin") as DocumentVisibility,
      employee_membership: item.employee_membership ? String(item.employee_membership) : "",
      file: null,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveDocument(e: React.FormEvent) {
    e.preventDefault();

    if (!activeMembership?.company) {
      setFlash({ type: "error", text: "Current company could not be detected." });
      return;
    }

    if (!form.title.trim()) {
      setFlash({ type: "error", text: "Please enter a title." });
      return;
    }

    if (!editingItem && !form.file) {
      setFlash({ type: "error", text: "Please choose a file." });
      return;
    }

    try {
      setActionLoading(editingItem ? "update" : "create");
      setFlash(null);

      if (editingItem) {
        const payload: DocumentUpdatePayload = {
          company: activeMembership.company,
          employee_membership: form.employee_membership
            ? Number(form.employee_membership)
            : null,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          visibility: form.visibility,
        };

        if (form.file) {
          payload.file = form.file;
        }

        await updateDocument(editingItem.id, payload);
        setFlash({ type: "success", text: "Document updated successfully." });
      } else {
        const payload: DocumentCreatePayload = {
          company: activeMembership.company,
          employee_membership: form.employee_membership
            ? Number(form.employee_membership)
            : null,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          visibility: form.visibility,
          file: form.file as File,
        };

        await createDocument(payload);
        setFlash({ type: "success", text: "Document uploaded successfully." });
      }

      resetForm();
      await loadData(false);
    } catch (error) {
      setFlash({
        type: "error",
        text: parseApiError(error, "Document could not be saved."),
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteDocument(item: DocumentItem) {
    const confirmed = window.confirm(
      `Delete document "${item.title}"? This will remove it from active company documents.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`delete-${item.id}`);
      setFlash(null);

      await deleteDocument(item.id);

      setFlash({ type: "success", text: "Document deleted successfully." });
      await loadData(false);
    } catch (error) {
      setFlash({
        type: "error",
        text: parseApiError(error, "Document could not be deleted."),
      });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PersonnelSubnav />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Loading personnel documents...
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PersonnelSubnav />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          You do not have permission to manage company documents.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PersonnelSubnav />

      {flash ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <section className="rounded-3xl bg-slate-900 px-6 py-7 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-300">Personnel / Documents</div>
            <h1 className="mt-2 text-3xl font-semibold">Document management</h1>
            <p className="mt-2 text-sm text-slate-300">
              Manage employee and company documents in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadData(false)}
            className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="All documents" value={stats.total} helper="Company-wide active files" />
        <StatCard label="Private" value={stats.privateCount} helper="Assigned to one employee" />
        <StatCard label="Company admin" value={stats.adminCount} helper="Visible to admin only" />
        <StatCard label="Company all" value={stats.allCount} helper="Visible company-wide" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingItem ? "Edit document" : "Upload document"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create company documents or assign files directly to an employee.
          </p>
        </div>

        <form onSubmit={handleSaveDocument} className="grid gap-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="Example: Employment contract, invoice, medical note"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Employee</label>
              <select
                value={form.employee_membership}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    employee_membership: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
              >
                <option value="">No employee assignment</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getEmployeeFullName(item)} {item.employee_number ? `(${item.employee_number})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category: e.target.value as DocumentCategory,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
              >
                <option value="general">General</option>
                <option value="invoice">Invoice</option>
                <option value="receipt">Receipt</option>
                <option value="contract">Contract</option>
                <option value="sick_note">Sick Note</option>
                <option value="vacation_attachment">Vacation Attachment</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    visibility: e.target.value as DocumentVisibility,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
              >
                <option value="private">Private</option>
                <option value="company_admin">Company Admin</option>
                <option value="company_all">Company All</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Optional description for the document"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {editingItem ? "Replace file (optional)" : "File"}
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
              <p className="mt-2 text-xs text-slate-500">Selected: {form.file.name}</p>
            ) : null}
            {editingItem?.original_filename ? (
              <p className="mt-1 text-xs text-slate-500">
                Current file: {editingItem.original_filename}
              </p>
            ) : null}
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
                ? "Save changes"
                : "Upload document"}
            </button>

            {editingItem ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel editing
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <p className="mt-1 text-sm text-slate-500">
            Narrow down documents by employee, category, visibility, or text.
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, file name, employee..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Employee</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            >
              <option value="">All employees</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {getEmployeeFullName(item)} {item.employee_number ? `(${item.employee_number})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as "" | DocumentCategory)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            >
              <option value="">All categories</option>
              <option value="general">General</option>
              <option value="invoice">Invoice</option>
              <option value="receipt">Receipt</option>
              <option value="contract">Contract</option>
              <option value="sick_note">Sick Note</option>
              <option value="vacation_attachment">Vacation Attachment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Visibility</label>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as "" | DocumentVisibility)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            >
              <option value="">All visibility</option>
              <option value="private">Private</option>
              <option value="company_admin">Company Admin</option>
              <option value="company_all">Company All</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Company documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            All active documents visible within your company membership.
          </p>
        </div>

        <div className="p-6">
          {pageError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {pageError}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              No documents found for the selected filters.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredDocuments.map((item) => {
                const employee = item.employee_membership
                  ? employeeMap.get(Number(item.employee_membership))
                  : null;

                const employeeName =
                  getEmployeeFullName(employee) ||
                  item.employee_full_name ||
                  "-";

                const employeeNumber = employee?.employee_number || "-";

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-base font-semibold text-slate-900">
                            {item.title}
                          </div>

                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getCategoryTone(
                              item.category
                            )}`}
                          >
                            {getDocumentCategoryLabel(item.category)}
                          </span>

                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getVisibilityTone(
                              item.visibility
                            )}`}
                          >
                            {getDocumentVisibilityLabel(item.visibility)}
                          </span>
                        </div>

                        <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <span className="font-medium text-slate-800">Document ID:</span>{" "}
                            {item.public_id || "-"}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">Employee:</span>{" "}
                            {employeeName}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">Employee No:</span>{" "}
                            {employeeNumber}
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
                            <span className="font-medium text-slate-800">Uploaded by:</span>{" "}
                            {item.uploaded_by_name || "-"}
                          </div>
                        </div>

                        {item.description ? (
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            {item.description}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:max-w-[340px] lg:justify-end">
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
                          onClick={() => startEdit(item)}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(item)}
                          disabled={actionLoading === `delete-${item.id}`}
                          className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionLoading === `delete-${item.id}` ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}