"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  buildProjectLabel,
  createProjectType,
  deleteProjectType,
  getProjectResults,
  getProjectTypeResults,
  getProjects,
  getProjectTypes,
  updateProjectType,
  type ProjectItem,
  type ProjectTypeItem,
} from "@/services/api/projects";
import { getMyMemberships } from "@/services/api/employees";

type FlashMessage =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

type MembershipLike = {
  company?: number;
  company_id?: number;
  company_public_id?: string;
  company_name?: string;
  role?: string;
};

type ProjectTypeFormState = {
  id: number | null;
  name: string;
  description: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_TYPE_FORM: ProjectTypeFormState = {
  id: null,
  name: "",
  description: "",
  sort_order: "0",
  is_active: true,
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const styles =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : tone === "warning"
      ? "bg-amber-100 text-amber-700 ring-amber-200"
      : tone === "danger"
      ? "bg-rose-100 text-rose-700 ring-rose-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {children}
    </span>
  );
}

function CardStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getStatusTone(status?: string): "default" | "success" | "warning" | "danger" {
  const value = normalize(status);
  if (value === "active") return "success";
  if (value === "planned") return "warning";
  if (value === "cancelled") return "danger";
  return "default";
}

export default function ProjectsPage() {
  const { access } = useAuth();

  const [membership, setMembership] = useState<MembershipLike | null>(null);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [savingType, setSavingType] = useState(false);

  const [pageError, setPageError] = useState("");
  const [flash, setFlash] = useState<FlashMessage>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [projectTypeFilter, setProjectTypeFilter] = useState("");

  const [typeForm, setTypeForm] = useState<ProjectTypeFormState>(EMPTY_TYPE_FORM);

  const companyId = membership?.company ?? membership?.company_id ?? null;
  const companyPublicId = membership?.company_public_id ?? "";
  const companyName = membership?.company_name ?? "";
  const userRole = normalize(membership?.role);

  const canManageProjectTypes =
    userRole === "owner" || userRole === "admin";

  const loadMembership = useCallback(async () => {
    if (!access) return;
    try {
      const data = await getMyMemberships(access);
      setMembership(data?.[0] ?? null);
    } catch (error: any) {
      setPageError(error?.detail || "Membership could not be loaded.");
    }
  }, [access]);

  const loadProjects = useCallback(async () => {
    if (!access || !companyPublicId) return;

    setLoadingProjects(true);
    try {
      const response = await getProjects({
        token: access,
        companyPublicId,
      });
      setProjects(getProjectResults(response));
    } catch (error: any) {
      setPageError(error?.detail || "Projects could not be loaded.");
    } finally {
      setLoadingProjects(false);
    }
  }, [access, companyPublicId]);

  const loadProjectTypes = useCallback(async () => {
    if (!access || !companyPublicId) return;

    setLoadingTypes(true);
    try {
      const response = await getProjectTypes({
        token: access,
        companyPublicId,
      });
      setProjectTypes(getProjectTypeResults(response));
    } catch (error: any) {
      setPageError(error?.detail || "Project types could not be loaded.");
    } finally {
      setLoadingTypes(false);
    }
  }, [access, companyPublicId]);

  useEffect(() => {
    loadMembership();
  }, [loadMembership]);

  useEffect(() => {
    if (!companyPublicId) return;
    loadProjects();
    loadProjectTypes();
  }, [companyPublicId, loadProjects, loadProjectTypes]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const filteredProjects = useMemo(() => {
    const needle = normalize(search);

    return projects.filter((item) => {
      const matchesSearch =
        !needle ||
        [
          item.project_number,
          item.name,
          item.description,
          item.customer_name,
          item.project_type_name,
          item.site_location,
          item.status,
        ]
          .map(normalize)
          .some((value) => value.includes(needle));

      const matchesStatus =
        !statusFilter || normalize(item.status) === normalize(statusFilter);

      const matchesActivity =
        !activityFilter
          ? true
          : activityFilter === "active"
          ? item.is_active === true
          : item.is_active === false;

      const matchesType =
        !projectTypeFilter
          ? true
          : String(item.project_type ?? "") === projectTypeFilter;

      return matchesSearch && matchesStatus && matchesActivity && matchesType;
    });
  }, [projects, search, statusFilter, activityFilter, projectTypeFilter]);

  const stats = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter((item) => normalize(item.status) === "active").length,
      planned: projects.filter((item) => normalize(item.status) === "planned").length,
      completed: projects.filter((item) => normalize(item.status) === "completed").length,
    };
  }, [projects]);

  function resetTypeForm() {
    setTypeForm(EMPTY_TYPE_FORM);
  }

  function startEditProjectType(item: ProjectTypeItem) {
    setTypeForm({
      id: item.id,
      name: item.name ?? "",
      description: item.description ?? "",
      sort_order: String(item.sort_order ?? 0),
      is_active: item.is_active !== false,
    });
  }

  async function handleTypeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!access || !companyId) {
      setFlash({ type: "error", text: "Company context is missing." });
      return;
    }

    const name = typeForm.name.trim();
    if (!name) {
      setFlash({ type: "error", text: "Project type name is required." });
      return;
    }

    setSavingType(true);
    try {
      const payload = {
        company: companyId,
        name,
        description: typeForm.description.trim(),
        sort_order: Number(typeForm.sort_order || 0),
        is_active: typeForm.is_active,
      };

      if (typeForm.id) {
        await updateProjectType(access, typeForm.id, payload);
        setFlash({ type: "success", text: "Project type updated successfully." });
      } else {
        await createProjectType(access, payload);
        setFlash({ type: "success", text: "Project type created successfully." });
      }

      resetTypeForm();
      await loadProjectTypes();
    } catch (error: any) {
      setFlash({
        type: "error",
        text: error?.detail || "Project type could not be saved.",
      });
    } finally {
      setSavingType(false);
    }
  }

  async function handleDeleteProjectType(item: ProjectTypeItem) {
    if (!access) return;

    const confirmed = window.confirm(
      `Delete project type "${item.name}"?`
    );
    if (!confirmed) return;

    try {
      await deleteProjectType(access, item.id);
      setFlash({ type: "success", text: "Project type deleted successfully." });
      if (typeForm.id === item.id) resetTypeForm();
      await loadProjectTypes();
    } catch (error: any) {
      setFlash({
        type: "error",
        text: error?.detail || "Project type could not be deleted.",
      });
    }
  }

  return (
    <section className="space-y-6">
      {flash ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Dashboard / Projects</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Projects
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Hier siehst du alle Projekte deiner Firma mit Projektart und Projektort.
              Die Seite entscheidet nichts fachlich selbst, sondern lädt und speichert
              nur sauber gegen das Backend.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="font-medium text-slate-900">{companyName || "-"}</div>
            <div className="mt-1 text-slate-500">Role: {membership?.role || "-"}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardStat label="Total projects" value={stats.total} />
        <CardStat label="Active" value={stats.active} />
        <CardStat label="Planned" value={stats.planned} />
        <CardStat label="Completed" value={stats.completed} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Project, customer, place, type..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="">All statuses</option>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Activity
            </label>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Project type
            </label>
            <select
              value={projectTypeFilter}
              onChange={(e) => setProjectTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="">All types</option>
              {projectTypes.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loadingProjects ? (
          <div className="p-10 text-sm text-slate-500">Loading projects...</div>
        ) : pageError ? (
          <div className="p-10">
            <h3 className="text-base font-semibold text-slate-900">
              Projects could not be loaded
            </h3>
            <p className="mt-2 text-sm text-slate-600">{pageError}</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-10 text-sm text-slate-500">
            No projects match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Place</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProjects.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">
                        {buildProjectLabel(item)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.name}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {item.customer_name || "-"}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {item.project_type_name || "-"}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {item.site_location || "-"}
                    </td>

                    <td className="px-4 py-4">
                      <Badge tone={getStatusTone(item.status)}>
                        {item.status || "-"}
                      </Badge>
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(item.start_date)}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(item.end_date)}
                    </td>

                    <td className="px-4 py-4">
                      <Badge tone={item.is_active ? "success" : "default"}>
                        {item.is_active ? "active" : "inactive"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManageProjectTypes ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Project types
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Company admin can create and manage the project type list here.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              {loadingTypes ? (
                <div className="p-6 text-sm text-slate-500">
                  Loading project types...
                </div>
              ) : projectTypes.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No project types available yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-600">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium">Order</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {projectTypes.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4 font-medium text-slate-900">
                            {item.name}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {item.description || "-"}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {item.sort_order ?? 0}
                          </td>
                          <td className="px-4 py-4">
                            <Badge tone={item.is_active ? "success" : "default"}>
                              {item.is_active ? "active" : "inactive"}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEditProjectType(item)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProjectType(item)}
                                className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {typeForm.id ? "Edit project type" : "Create project type"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  These values are used as the selectable project type list.
                </p>
              </div>

              {typeForm.id ? (
                <button
                  type="button"
                  onClick={resetTypeForm}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
              ) : null}
            </div>

            <form onSubmit={handleTypeSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Name
                </label>
                <input
                  value={typeForm.name}
                  onChange={(e) =>
                    setTypeForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Electrical installation"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={typeForm.description}
                  onChange={(e) =>
                    setTypeForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Optional description"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Sort order
                  </label>
                  <input
                    type="number"
                    value={typeForm.sort_order}
                    onChange={(e) =>
                      setTypeForm((prev) => ({
                        ...prev,
                        sort_order: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={typeForm.is_active}
                      onChange={(e) =>
                        setTypeForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    Active
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingType}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingType
                  ? "Saving..."
                  : typeForm.id
                  ? "Update project type"
                  : "Create project type"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}