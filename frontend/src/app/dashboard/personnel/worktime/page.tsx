"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PersonnelSubnav from "@/components/dashboard/PersonnelSubnav";
import { useAuth } from "@/context/AuthContext";
import {
  getEmployees,
  getMyMemberships,
  type EmployeeMembershipItem,
} from "@/services/api/employees";
import {
  buildProjectLabel,
  getActiveProjects,
  getProjectResults,
  getProjects,
  type ProjectItem,
} from "@/services/api/projects";
import {
  createManualWorktime,
  getWorktimeEntries,
  updateWorktimeEntry,
  type WorktimeEntry,
  type WorkTimeStatus,
} from "@/services/api/worktime";

type FlashMessage =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

type Filters = {
  search: string;
  employeeMembershipId: string;
  status: string;
  entryType: string;
  workDateFrom: string;
  workDateTo: string;
  isActive: string;
};

type ManualFormState = {
  employee_membership: string;
  project: string;
  started_at: string;
  ended_at: string;
  break_minutes: string;
  title: string;
  description: string;
  internal_note: string;
};

type EditFormState = {
  public_id: string;
  project: string;
  status: WorkTimeStatus;
  started_at: string;
  ended_at: string;
  break_minutes: string;
  title: string;
  description: string;
  internal_note: string;
  is_active: boolean;
};

type MyMembershipItem = {
  id: number;
  company: number;
  company_public_id?: string;
  company_name?: string;
  role: "owner" | "admin" | "employee";
  is_active: boolean;
};

const STATUS_OPTIONS: WorkTimeStatus[] = [
  "running",
  "submitted",
  "approved",
  "rejected",
];

function InfoCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "rejected"
      ? "bg-red-100 text-red-700"
      : status === "running"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {status || "-"}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (num: number) => String(num).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoValue(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatDurationHoursToHHMM(value?: string | number | null) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "00:00";
  }

  const totalMinutes = Math.round(numeric * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export default function PersonnelWorktimePage() {
  const { access } = useAuth();

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [flash, setFlash] = useState<FlashMessage>(null);

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyPublicId, setCompanyPublicId] = useState("");
  const [currentRole, setCurrentRole] = useState("");

  const [employees, setEmployees] = useState<EmployeeMembershipItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [entries, setEntries] = useState<WorktimeEntry[]>([]);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    employeeMembershipId: "",
    status: "",
    entryType: "",
    workDateFrom: "",
    workDateTo: "",
    isActive: "",
  });

  const [manualOpen, setManualOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [manualForm, setManualForm] = useState<ManualFormState>({
    employee_membership: "",
    project: "",
    started_at: "",
    ended_at: "",
    break_minutes: "0",
    title: "",
    description: "",
    internal_note: "",
  });

  const [editForm, setEditForm] = useState<EditFormState>({
    public_id: "",
    project: "",
    status: "submitted",
    started_at: "",
    ended_at: "",
    break_minutes: "0",
    title: "",
    description: "",
    internal_note: "",
    is_active: true,
  });

  const canManage = currentRole === "owner" || currentRole === "admin";
  const activeProjects = useMemo(() => getActiveProjects(projects), [projects]);

  const filteredEntries = useMemo(() => {
    const search = normalize(filters.search);
    if (!search) return entries;

    return entries.filter((entry) =>
      [
        entry.public_id,
        entry.employee_name,
        entry.project_name,
        entry.title,
        entry.description,
        entry.internal_note,
        entry.status,
        entry.entry_type,
      ]
        .map(normalize)
        .some((value) => value.includes(search))
    );
  }, [entries, filters.search]);

  const stats = useMemo(() => {
  const totalEntries = entries.length;
  const submitted = entries.filter((item) => item.status === "submitted").length;
  const approved = entries.filter((item) => item.status === "approved").length;
  const rejected = entries.filter((item) => item.status === "rejected").length;

  const totalApprovedHours = entries
    .filter((item) => item.status === "approved")
    .reduce((sum, item) => {
      const value = Number(item.duration_hours || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

  return {
    totalEntries,
    submitted,
    approved,
    rejected,
    totalHours: formatDurationHoursToHHMM(totalApprovedHours),
  };
}, [entries]);

  const loadBaseData = useCallback(async () => {
    if (!access) return;

    setLoadingBase(true);
    setPageError("");

    try {
      const myMemberships = (await getMyMemberships(access)) as MyMembershipItem[];
      const activeMembership =
        myMemberships.find((item) => item.is_active) || myMemberships[0];

      if (!activeMembership?.company) {
        throw { detail: "No active company membership found." };
      }

      setCompanyId(activeMembership.company);
      setCompanyPublicId(activeMembership.company_public_id || "");
      setCurrentRole(activeMembership.role || "");

      const [employeeItems, projectResponse] = await Promise.all([
        getEmployees({
          token: access,
          companyId: activeMembership.company,
        }),
        activeMembership.company_public_id
          ? getProjects(access, activeMembership.company_public_id)
          : Promise.resolve([] as any),
      ]);

      setEmployees(employeeItems);
      setProjects(getProjectResults(projectResponse as any));
    } catch (error: any) {
      setPageError(error?.detail || "Base data could not be loaded.");
    } finally {
      setLoadingBase(false);
    }
  }, [access]);

  const loadEntryData = useCallback(async () => {
    if (!access || !companyId) return;

    setLoadingEntries(true);
    setPageError("");

    try {
      const entryItems = await getWorktimeEntries({
        token: access,
        companyId,
        employeeMembershipId: filters.employeeMembershipId || undefined,
        status: filters.status || undefined,
        entryType: filters.entryType || undefined,
        workDateFrom: filters.workDateFrom || undefined,
        workDateTo: filters.workDateTo || undefined,
        isActive: filters.isActive || undefined,
        search: filters.search || undefined,
      });

      setEntries(entryItems);
    } catch (error: any) {
      setPageError(error?.detail || "Work time entries could not be loaded.");
    } finally {
      setLoadingEntries(false);
    }
  }, [
    access,
    companyId,
    filters.employeeMembershipId,
    filters.entryType,
    filters.isActive,
    filters.search,
    filters.status,
    filters.workDateFrom,
    filters.workDateTo,
  ]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (!companyId) return;
    loadEntryData();
  }, [companyId, loadEntryData]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (!manualForm.employee_membership && employees.length > 0) {
      setManualForm((prev) => ({
        ...prev,
        employee_membership: String(employees[0].id),
      }));
    }
  }, [employees, manualForm.employee_membership]);

  useEffect(() => {
    if (!manualForm.project && activeProjects.length > 0) {
      setManualForm((prev) => ({
        ...prev,
        project: String(activeProjects[0].id),
      }));
    }
  }, [activeProjects, manualForm.project]);

  function openEdit(entry: WorktimeEntry) {
    setEditForm({
      public_id: entry.public_id,
      project: entry.project ? String(entry.project) : "",
      status: entry.status,
      started_at: toDateTimeLocalValue(entry.started_at),
      ended_at: toDateTimeLocalValue(entry.ended_at),
      break_minutes: String(entry.break_minutes ?? 0),
      title: entry.title || "",
      description: entry.description || "",
      internal_note: entry.internal_note || "",
      is_active: entry.is_active !== false,
    });
    setEditOpen(true);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!access || !companyId) return;

    if (!manualForm.employee_membership) {
      setFlash({ type: "error", text: "Please select an employee." });
      return;
    }

    if (!manualForm.started_at || !manualForm.ended_at) {
      setFlash({ type: "error", text: "Please enter start and end time." });
      return;
    }

    if (!manualForm.internal_note.trim()) {
      setFlash({ type: "error", text: "A comment is required for manual entries." });
      return;
    }

    setSaving(true);

    try {
      await createManualWorktime(access, {
        company: companyId,
        employee_membership: Number(manualForm.employee_membership),
        project: manualForm.project ? Number(manualForm.project) : null,
        work_date: manualForm.started_at.slice(0, 10),
        started_at: toIsoValue(manualForm.started_at) || "",
        ended_at: toIsoValue(manualForm.ended_at) || "",
        break_minutes: Number(manualForm.break_minutes || 0),
        title: manualForm.title || "",
        description: manualForm.description || "",
        internal_note: manualForm.internal_note.trim(),
      });

      setManualOpen(false);
      setManualForm({
        employee_membership: employees[0] ? String(employees[0].id) : "",
        project: activeProjects[0] ? String(activeProjects[0].id) : "",
        started_at: "",
        ended_at: "",
        break_minutes: "0",
        title: "",
        description: "",
        internal_note: "",
      });

      await loadEntryData();
      setFlash({ type: "success", text: "Work time entry was added successfully." });
    } catch (error: any) {
      setFlash({
        type: "error",
        text:
          error?.detail ||
          error?.internal_note?.[0] ||
          error?.started_at?.[0] ||
          error?.ended_at?.[0] ||
          "Manual entry could not be created.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!access || !editForm.public_id) return;

    

    setSaving(true);

    try {
      await updateWorktimeEntry(access, editForm.public_id, {
        project: editForm.project ? Number(editForm.project) : null,
        status: editForm.status,
        work_date: editForm.started_at.slice(0, 10),
        started_at: toIsoValue(editForm.started_at),
        ended_at: editForm.ended_at ? toIsoValue(editForm.ended_at) : null,
        break_minutes: Number(editForm.break_minutes || 0),
        title: editForm.title || "",
        description: editForm.description || "",
        internal_note: editForm.internal_note.trim(),
        is_active: editForm.is_active,
      });

      setEditOpen(false);
      await loadEntryData();
      setFlash({
        type: "success",
        text: "Work time entry was updated successfully.",
      });
    } catch (error: any) {
      setFlash({
        type: "error",
        text:
          error?.detail ||
          error?.status?.[0] ||
          error?.internal_note?.[0] ||
          error?.started_at?.[0] ||
          error?.ended_at?.[0] ||
          "Entry could not be updated.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!canManage && !loadingBase) {
    return (
      <div className="space-y-6">
        <PersonnelSubnav />
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Worktime management</h1>
          <p className="mt-2 text-sm text-amber-700">
            This page is available for owner and admin users.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PersonnelSubnav />

      {flash ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Worktime management</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Review all employee worktime entries, edit existing items, and create
              manual entries for employees.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Add entry
            </button>

            <button
              type="button"
              onClick={() => loadEntryData()}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-500">
          {companyPublicId ? `Company: ${companyPublicId}` : ""}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InfoCard
          label="Total entries"
          value={stats.totalEntries}
          helper="All loaded worktime records"
        />
        <InfoCard label="Submitted" value={stats.submitted} helper="Waiting for approval" />
        <InfoCard label="Approved" value={stats.approved} helper="Already approved" />
        <InfoCard label="Rejected" value={stats.rejected} helper="Rejected entries" />
        <InfoCard label="Total hours" value={stats.totalHours} helper="Sum in HH:MM" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <div className="xl:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Employee, project, title, public ID..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Employee</label>
            <select
              value={filters.employeeMembershipId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, employeeMembershipId: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.user?.full_name ||
                    [employee.user?.first_name, employee.user?.last_name]
                      .filter(Boolean)
                      .join(" ") ||
                    employee.user?.email ||
                    employee.employee_number ||
                    `Membership ${employee.id}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All statuses</option>
              <option value="running">Running</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
            <select
              value={filters.entryType}
              onChange={(e) => setFilters((prev) => ({ ...prev, entryType: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All types</option>
              <option value="timer">Timer</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">From</label>
            <input
              type="date"
              value={filters.workDateFrom}
              onChange={(e) => setFilters((prev) => ({ ...prev, workDateFrom: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">To</label>
            <input
              type="date"
              value={filters.workDateTo}
              onChange={(e) => setFilters((prev) => ({ ...prev, workDateTo: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Active</label>
            <select
              value={filters.isActive}
              onChange={(e) => setFilters((prev) => ({ ...prev, isActive: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loadingEntries ? (
          <div className="p-8 text-sm text-slate-500">Loading worktime entries...</div>
        ) : pageError ? (
          <div className="p-8">
            <h3 className="text-lg font-semibold text-slate-900">Entries could not be loaded</h3>
            <p className="mt-2 text-sm text-red-600">{pageError}</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No entries match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Public ID</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Break</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredEntries.map((entry) => (
                  <tr key={entry.public_id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                      <div>{entry.public_id}</div>
                      <div className="mt-1 text-xs font-normal text-slate-400">
                        {entry.entry_type || "-"}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">
                        {entry.employee_name || "-"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {entry.project_name || "-"}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatDate(entry.work_date)}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatDateTime(entry.started_at)}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatDateTime(entry.ended_at)}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {entry.break_minutes ?? 0} min
                    </td>

                    <td className="px-4 py-4 text-sm font-medium text-slate-700">
                      {formatDurationHoursToHHMM(entry.duration_hours)}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={entry.status || "-"} />
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Add manual worktime entry</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Create a manual worktime record for an employee.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="grid gap-4 p-6 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Employee</label>
                <select
                  value={manualForm.employee_membership}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      employee_membership: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.user?.full_name ||
                        [employee.user?.first_name, employee.user?.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        employee.user?.email ||
                        employee.employee_number ||
                        `Membership ${employee.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Project</label>
                <select
                  value={manualForm.project}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      project: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">No project</option>
                  {activeProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {buildProjectLabel(project)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Start time</label>
                <input
                  type="datetime-local"
                  value={manualForm.started_at}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      started_at: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">End time</label>
                <input
                  type="datetime-local"
                  value={manualForm.ended_at}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      ended_at: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Break minutes</label>
                <input
                  type="number"
                  min={0}
                  value={manualForm.break_minutes}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      break_minutes: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
                <input
                  value={manualForm.title}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={manualForm.description}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Comment</label>
                <textarea
                  rows={4}
                  required
                  value={manualForm.internal_note}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      internal_note: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  placeholder="Reason for the manual entry..."
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Edit worktime entry</h3>
                <p className="mt-1 text-sm text-slate-500">{editForm.public_id}</p>
              </div>

              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="grid gap-4 p-6 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Project</label>
                <select
                  value={editForm.project}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      project: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">No project</option>
                  {activeProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {buildProjectLabel(project)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      status: e.target.value as WorkTimeStatus,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center rounded-2xl border border-slate-200 px-4 py-3 sm:col-span-2">
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                      }))
                    }
                  />
                  Entry active
                </label>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Start time</label>
                <input
                  type="datetime-local"
                  value={editForm.started_at}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      started_at: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">End time</label>
                <input
                  type="datetime-local"
                  value={editForm.ended_at}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      ended_at: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Break minutes</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.break_minutes}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      break_minutes: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
                <input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Comment</label>
                <textarea
                  rows={4}
                  value={editForm.internal_note}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      internal_note: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  placeholder="Reason for this change..."
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}