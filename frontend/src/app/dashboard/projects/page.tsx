"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  buildProjectLabel,
  getProjectByPublicId,
  getProjectResults,
  getProjectTypeResults,
  getProjects,
  getProjectTypes,
  updateProject,
  type ProjectItem,
  type ProjectTypeItem,
  type ProjectUpdatePayload,
} from "@/services/api/projects";

type FlashMessage =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

type ProjectFormState = {
  name: string;
  project_number: string;
  project_type: string;
  site_location: string;
  status: string;
  start_date: string;
  end_date: string;
  budget: string;
  description: string;
  is_active: boolean;
};

const STATUS_OPTIONS = [
  { value: "", label: "Alle Status" },
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

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

function formatDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatMoney(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "-";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return String(value);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(numberValue);
}

function getStatusTone(status?: string) {
  const value = normalize(status);
  if (value === "active") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  if (value === "completed") {
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  }
  if (value === "cancelled") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
}

function getActiveTone(isActive?: boolean) {
  if (isActive === false) {
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
}

function toFormState(project: ProjectItem | null): ProjectFormState {
  return {
    name: project?.name ?? "",
    project_number: project?.project_number ?? "",
    project_type: project?.project_type ? String(project.project_type) : "",
    site_location: project?.site_location ?? "",
    status: project?.status ?? "planned",
    start_date: formatDateInput(project?.start_date),
    end_date: formatDateInput(project?.end_date),
    budget:
      project?.budget !== undefined && project?.budget !== null
        ? String(project.budget)
        : "",
    description: project?.description ?? "",
    is_active: project?.is_active !== false,
  };
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm text-slate-900">{value}</div>
    </div>
  );
}

function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-sm text-slate-500">{text}</div>
    </div>
  );
}

function EditProjectModal({
  open,
  saving,
  form,
  projectTypes,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  form: ProjectFormState;
  projectTypes: ProjectTypeItem[];
  onClose: () => void;
  onChange: (patch: Partial<ProjectFormState>) => void;
  onSave: () => void;
}) {
  if (!open) return null;

  const selectedType =
    projectTypes.find((item) => String(item.id) === form.project_type) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Projekt bearbeiten</h3>
            <p className="mt-1 text-sm text-slate-500">
              Nur die relevanten Projektdaten bearbeiten.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Schließen
          </button>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Projektname
            </label>
            <input
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Projektnummer
            </label>
            <input
              value={form.project_number}
              onChange={(e) => onChange({ project_number: e.target.value })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Projektart
            </label>
            <select
              value={form.project_type}
              onChange={(e) => onChange({ project_type: e.target.value })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            >
              <option value="">Keine Auswahl</option>
              {projectTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {selectedType?.description ? (
              <p className="mt-2 text-xs text-slate-500">{selectedType.description}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Ort des Projekts
            </label>
            <input
              value={form.site_location}
              onChange={(e) => onChange({ site_location: e.target.value })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => onChange({ status: e.target.value })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            >
              {STATUS_OPTIONS.filter((item) => item.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Budget
            </label>
            <input
              value={form.budget}
              onChange={(e) => onChange({ budget: e.target.value })}
              placeholder="z. B. 12500.00"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Startdatum
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => onChange({ start_date: e.target.value })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Enddatum
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => onChange({ end_date: e.target.value })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Beschreibung
            </label>
            <textarea
              rows={5}
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => onChange({ is_active: e.target.checked })}
              />
              Projekt ist aktiv
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Speichert..." : "Änderungen speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { access, company, membership } = useAuth();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [flash, setFlash] = useState<FlashMessage>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectTypeFilter, setProjectTypeFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProjectFormState>(toFormState(null));

  const companyPublicId = company?.public_id ?? "";

  const loadProjects = useCallback(async () => {
    if (!access || !companyPublicId) return;

    setLoading(true);
    setPageError("");

    try {
      const [projectsResponse, typesResponse] = await Promise.all([
        getProjects({
          token: access,
          companyPublicId,
          status: statusFilter || undefined,
          projectTypeId: projectTypeFilter || undefined,
          isActive: activityFilter || undefined,
        }),
        getProjectTypes({
          token: access,
          companyPublicId,
          isActive: "true",
        }),
      ]);

      const nextProjects = getProjectResults(projectsResponse);
      const nextTypes = getProjectTypeResults(typesResponse);

      setProjects(nextProjects);
      setProjectTypes(nextTypes);

      if (!nextProjects.length) {
        setSelectedProjectId("");
        setSelectedProject(null);
        return;
      }

      const found =
        nextProjects.find((item) => item.public_id === selectedProjectId) ??
        nextProjects[0];

      setSelectedProjectId(found.public_id);
    } catch (error: any) {
      setPageError(error?.detail || "Projekte konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [access, companyPublicId, statusFilter, projectTypeFilter, activityFilter, selectedProjectId]);

  const loadProjectDetail = useCallback(
    async (publicId: string) => {
      if (!access || !publicId) return;

      setDetailLoading(true);
      try {
        const data = await getProjectByPublicId(access, publicId);
        setSelectedProject(data);
        setForm(toFormState(data));
      } catch (error: any) {
        setSelectedProject(null);
        setFlash({
          type: "error",
          text: error?.detail || "Projektdetails konnten nicht geladen werden.",
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [access]
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!selectedProjectId) return;
    loadProjectDetail(selectedProjectId);
  }, [selectedProjectId, loadProjectDetail]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const filteredProjects = useMemo(() => {
    const needle = normalize(search);
    if (!needle) return projects;

    return projects.filter((item) =>
      [
        item.project_number,
        item.name,
        item.customer_name,
        item.project_type_name,
        item.site_location,
        item.description,
        item.status,
      ]
        .map(normalize)
        .some((value) => value.includes(needle))
    );
  }, [projects, search]);

  const stats = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter((item) => normalize(item.status) === "active").length,
      planned: projects.filter((item) => normalize(item.status) === "planned").length,
      completed: projects.filter((item) => normalize(item.status) === "completed").length,
    };
  }, [projects]);

  async function handleSave() {
    if (!access || !selectedProject) return;

    if (!form.name.trim()) {
      setFlash({ type: "error", text: "Projektname ist erforderlich." });
      return;
    }

    const payload: ProjectUpdatePayload = {
      name: form.name.trim(),
      project_number: form.project_number.trim(),
      project_type: form.project_type ? Number(form.project_type) : null,
      site_location: form.site_location.trim(),
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget.trim() ? form.budget.trim() : null,
      description: form.description.trim(),
      is_active: form.is_active,
    };

    setSaving(true);

    try {
      const updated = await updateProject(access, selectedProject.public_id, payload);
      setSelectedProject(updated);
      setForm(toFormState(updated));
      setEditOpen(false);
      setFlash({ type: "success", text: "Projekt wurde erfolgreich aktualisiert." });
      await loadProjects();
      setSelectedProjectId(updated.public_id);
    } catch (error: any) {
      setFlash({
        type: "error",
        text: error?.detail || "Projekt konnte nicht gespeichert werden.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      {flash ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Dashboard / Projects
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Projekte
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Übersicht aller Projekte deiner Firma mit Details und Bearbeiten-Funktion.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">
            {company?.company_name || "-"}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            Rolle: {membership?.role || "-"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gesamt" value={stats.total} helper="Alle Projekte" />
        <StatCard label="Aktiv" value={stats.active} helper="Laufende Projekte" />
        <StatCard label="Geplant" value={stats.planned} helper="Noch nicht gestartet" />
        <StatCard label="Abgeschlossen" value={stats.completed} helper="Bereits erledigt" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suche
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Projekt, Kunde, Art, Ort..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Projektart
            </label>
            <select
              value={projectTypeFilter}
              onChange={(e) => setProjectTypeFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            >
              <option value="">Alle Arten</option>
              {projectTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Aktivität
            </label>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            >
              <option value="">Alle</option>
              <option value="true">Nur aktiv</option>
              <option value="false">Nur inaktiv</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-sm text-slate-600 shadow-sm">
          Projekte werden geladen...
        </div>
      ) : pageError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-sm text-rose-700">
          {pageError}
        </div>
      ) : !filteredProjects.length ? (
        <EmptyState
          title="Keine Projekte gefunden"
          text="Mit den aktuellen Filtern gibt es keine passenden Projekte."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.6fr_0.95fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Projektliste</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ohne Company und interne Projekt-ID, damit die Tabelle sauber bleibt.
                </p>
              </div>
              <div className="text-sm text-slate-500">
                {filteredProjects.length} Einträge
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Projekt</th>
                    <th className="px-5 py-3 font-semibold">Kunde</th>
                    <th className="px-5 py-3 font-semibold">Art</th>
                    <th className="px-5 py-3 font-semibold">Ort</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Zeitraum</th>
                    <th className="px-5 py-3 font-semibold">Aktiv</th>
                    <th className="px-5 py-3 font-semibold text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredProjects.map((item) => {
                    const isSelected = item.public_id === selectedProjectId;

                    return (
                      <tr
                        key={item.public_id}
                        className={`cursor-pointer transition hover:bg-slate-50 ${
                          isSelected ? "bg-slate-50" : "bg-white"
                        }`}
                        onClick={() => {
                          setEditOpen(false);
                          setSelectedProjectId(item.public_id);
                        }}
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900">
                            {buildProjectLabel(item)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{item.name}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {item.customer_name || "-"}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {item.project_type_name || "-"}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {item.site_location || "-"}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(
                              item.status
                            )}`}
                          >
                            {item.status || "-"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          <div>{formatDate(item.start_date)}</div>
                          <div className="text-xs text-slate-500">
                            bis {formatDate(item.end_date)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getActiveTone(
                              item.is_active
                            )}`}
                          >
                            {item.is_active === false ? "inactive" : "active"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProjectId(item.public_id);
                              setEditOpen(false);
                            }}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Öffnen
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            {!selectedProjectId ? (
              <div className="p-8">
                <EmptyState
                  title="Kein Projekt ausgewählt"
                  text="Wähle links ein Projekt aus, um alle Angaben zu sehen."
                />
              </div>
            ) : detailLoading && !selectedProject ? (
              <div className="p-8 text-sm text-slate-600">
                Projektdetails werden geladen...
              </div>
            ) : !selectedProject ? (
              <div className="p-8">
                <EmptyState
                  title="Details nicht verfügbar"
                  text="Die Projektdetails konnten nicht geladen werden."
                />
              </div>
            ) : (
              <>
                <div className="border-b border-slate-200 px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {buildProjectLabel(selectedProject)}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Detailansicht und Bearbeiten
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setForm(toFormState(selectedProject));
                        setEditOpen(true);
                      }}
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Bearbeiten
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(
                        selectedProject.status
                      )}`}
                    >
                      {selectedProject.status || "-"}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getActiveTone(
                        selectedProject.is_active
                      )}`}
                    >
                      {selectedProject.is_active === false ? "inactive" : "active"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-5">
                  <InfoItem label="Kunde" value={selectedProject.customer_name || "-"} />
                  <InfoItem
                    label="Projektart"
                    value={selectedProject.project_type_name || "-"}
                  />
                  <InfoItem
                    label="Ort des Projekts"
                    value={selectedProject.site_location || "-"}
                  />
                  <InfoItem
                    label="Budget"
                    value={formatMoney(selectedProject.budget)}
                  />
                  <InfoItem
                    label="Startdatum"
                    value={formatDate(selectedProject.start_date)}
                  />
                  <InfoItem
                    label="Enddatum"
                    value={formatDate(selectedProject.end_date)}
                  />
                  <InfoItem
                    label="Beschreibung"
                    value={
                      <div className="whitespace-pre-wrap">
                        {selectedProject.description || "-"}
                      </div>
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <EditProjectModal
        open={editOpen}
        saving={saving}
        form={form}
        projectTypes={projectTypes}
        onClose={() => {
          setEditOpen(false);
          setForm(toFormState(selectedProject));
        }}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onSave={handleSave}
      />
    </section>
  );
}