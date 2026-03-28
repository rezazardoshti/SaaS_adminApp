"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import {
  buildProjectLabel,
  getActiveProjects,
  getProjectResults,
  getProjects,
  type ProjectItem,
} from "@/services/api/projects";
import {
  endWork,
  formatMinutesToHours,
  getMyActiveWorktime,
  getMyWorktimeEntries,
  getWorktimeResults,
  startWork,
  type WorktimeEntry,
} from "@/services/api/worktime";
import { getMyMemberships } from "@/services/api/employees";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

type MembershipWithTarget = {
  id: number;
  role: "owner" | "admin" | "employee";
  company: number;
  company_public_id?: string;
  company_name?: string;
  employee_number?: string | null;
  job_title?: string | null;
  department?: string | null;
  employment_status?: string | null;
  is_active: boolean;
  monthly_target_hours?: number | string | null;
};

type EditFormState = {
  public_id: string;
  project: string;
  started_at: string;
  ended_at: string;
  break_minutes: string;
  title: string;
  description: string;
  internal_note: string;
};

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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </div>
  );
}

function ActionButton({
  label,
  helper,
  disabled = false,
  onClick,
  loading = false,
}: {
  label: string;
  helper: string;
  disabled?: boolean;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="flex w-full flex-col items-start rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-base font-semibold text-slate-900">
        {loading ? "Please wait..." : label}
      </span>
      <span className="mt-2 text-sm leading-6 text-slate-600">{helper}</span>
    </button>
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
      className={`rounded-2xl px-4 py-3 text-sm ${
        type === "success"
          ? "border border-green-200 bg-green-50 text-green-700"
          : "border border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {text}
    </div>
  );
}

function formatDateLabel(value?: string | null) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString();
}

function formatTimeLabel(value?: string | null) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return value;
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function formatSecondsAsHHMMSS(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

function getEntryDate(entry: WorktimeEntry) {
  return entry.work_date || entry.created_at || "";
}

function getEntryDateObject(entry: WorktimeEntry) {
  const raw = getEntryDate(entry);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function getEntryHours(entry: WorktimeEntry) {
  if (entry.duration_hours !== undefined && entry.duration_hours !== null) {
    const asNumber = Number(entry.duration_hours);

    if (!Number.isNaN(asNumber)) {
      const totalMinutes = Math.round(asNumber * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}`;
    }

    return String(entry.duration_hours);
  }

  if (typeof entry.duration_minutes === "number") {
    return formatMinutesToHours(entry.duration_minutes);
  }

  return "00:00";
}

function getEntryStatus(entry: WorktimeEntry, activeEntryId?: number | null) {
  if (activeEntryId && entry.id === activeEntryId) return "Running";
  if (entry.status) return entry.status;
  if (entry.ended_at) return "Submitted";
  if (entry.started_at && !entry.ended_at) return "Running";
  return "-";
}

function buildOvertimeLabel(minutes: number) {
  const sign = minutes < 0 ? "-" : "+";
  return `${sign}${formatMinutesToHours(Math.abs(minutes))}`;
}

function parseMonthValue(value: string) {
  const [yearStr, monthStr] = value.split("-");
  return {
    year: Number(yearStr),
    month: Number(monthStr),
  };
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

export default function WorkspaceWorktimePage() {
  const { user, membership, company, access: authAccess } = useAuth();
  const access = getSafeAccessToken(authAccess);
  const membershipFromContext = membership as MembershipWithTarget | null;

  const now = new Date();
  const [selectedMonthValue, setSelectedMonthValue] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const [resolvedMembership, setResolvedMembership] =
    useState<MembershipWithTarget | null>(membershipFromContext);
  const [entries, setEntries] = useState<WorktimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<WorktimeEntry | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [actionLoading, setActionLoading] = useState<
    "start" | "end" | "manual" | "edit" | null
  >(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [editOpenId, setEditOpenId] = useState<string | null>(null);

  const [manualForm, setManualForm] = useState({
    project: "",
    started_at: "",
    ended_at: "",
    internal_note: "",
    break_minutes: "0",
    title: "",
    description: "",
  });

  const [editForm, setEditForm] = useState<EditFormState>({
    public_id: "",
    project: "",
    started_at: "",
    ended_at: "",
    break_minutes: "0",
    title: "",
    description: "",
    internal_note: "",
  });

  const membershipData = resolvedMembership || membershipFromContext;

  const displayName = useMemo(() => {
    return (
      user?.full_name?.trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      user?.email ||
      "User"
    );
  }, [user]);

  const employeeNumber = membershipData?.employee_number || "-";
  const department = membershipData?.department || "-";
  const companyName =
    company?.company_name || membershipData?.company_name || "-";

  const activeProjects = useMemo(() => getActiveProjects(projects), [projects]);

  const selectedPeriod = useMemo(() => {
    return parseMonthValue(selectedMonthValue);
  }, [selectedMonthValue]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const date = getEntryDateObject(entry);
      if (!date) return false;

      return (
        date.getFullYear() === selectedPeriod.year &&
        date.getMonth() + 1 === selectedPeriod.month
      );
    });
  }, [entries, selectedPeriod]);

  const todaysEntry = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const activeDate =
      activeEntry?.work_date || activeEntry?.created_at?.slice(0, 10);

    if (activeEntry && activeDate === today) {
      return activeEntry;
    }

    return (
      entries.find((entry) => {
        const entryDate = entry.work_date || entry.created_at?.slice(0, 10);
        return entryDate === today;
      }) || null
    );
  }, [entries, activeEntry]);

  const currentStatus = useMemo(() => {
    if (activeEntry?.status) return activeEntry.status;
    if (activeEntry) return "running";
    return "Not started";
  }, [activeEntry]);

  const todayWorked = useMemo(() => {
    if (!todaysEntry) return "00:00";
    return getEntryHours(todaysEntry);
  }, [todaysEntry]);

  const approvedMinutesForSelectedMonth = useMemo(() => {
    return filteredEntries
      .filter((entry) => String(entry.status || "").toLowerCase() === "approved")
      .reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0);
  }, [filteredEntries]);

  const monthlyTargetMinutes = useMemo(() => {
    const monthlyTarget = Number(membershipData?.monthly_target_hours);

    if (!Number.isNaN(monthlyTarget) && monthlyTarget > 0) {
      return Math.round(monthlyTarget * 60);
    }

    return 0;
  }, [membershipData]);

  const overtimeMinutes = useMemo(() => {
    return approvedMinutesForSelectedMonth - monthlyTargetMinutes;
  }, [approvedMinutesForSelectedMonth, monthlyTargetMinutes]);

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

  useEffect(() => {
    if (!activeEntry?.started_at) {
      setTimerSeconds(0);
      return;
    }

    function updateTimer() {
      if (!activeEntry?.started_at) {
        setTimerSeconds(0);
        return;
      }

      const startedAt = new Date(activeEntry.started_at);
      const current = new Date();

      if (Number.isNaN(startedAt.getTime())) {
        setTimerSeconds(0);
        return;
      }

      const diffSeconds = Math.floor(
        (current.getTime() - startedAt.getTime()) / 1000
      );

      setTimerSeconds(Math.max(0, diffSeconds));
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeEntry?.started_at]);

  const loadWorktimeData = useCallback(
    async (showLoader = true) => {
      if (!access) {
        setPageLoading(false);
        setAuthReady(true);
        return;
      }

      try {
        if (showLoader) {
          setPageLoading(true);
        }

        setErrorMessage("");

        let activeMembership = membershipData;

        if (!activeMembership?.company) {
          const memberships = (await getMyMemberships(
            access
          )) as MembershipWithTarget[];

          activeMembership =
            memberships.find((item) => item.is_active) || memberships[0] || null;

          setResolvedMembership(activeMembership);
        }

        if (!activeMembership?.company) {
          throw {
            detail:
              "Company or employee membership is missing for this account.",
          };
        }

        const companyPublicId =
          company?.public_id || activeMembership.company_public_id;

        const [entriesResponse, activeResponse, projectsResponse] =
          await Promise.all([
            getMyWorktimeEntries({
              token: access,
              companyId: activeMembership.company,
            }),
            getMyActiveWorktime({
              token: access,
              companyId: activeMembership.company,
            }),
            companyPublicId
              ? getProjects(access, companyPublicId)
              : Promise.resolve([]),
          ]);

        setEntries(getWorktimeResults(entriesResponse));
        setActiveEntry(activeResponse || null);
        setProjects(getProjectResults(projectsResponse as any));
      } catch (error: any) {
        setErrorMessage(error?.detail || "Worktime data could not be loaded.");
      } finally {
        if (showLoader) {
          setPageLoading(false);
        }
        setAuthReady(true);
      }
    },
    [access, company?.public_id, membershipData]
  );

  useEffect(() => {
    loadWorktimeData(true);
  }, [loadWorktimeData]);

  useEffect(() => {
    if (!access) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadWorktimeData(false);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [access, loadWorktimeData]);

  useEffect(() => {
    if (!selectedProjectId && activeProjects.length > 0) {
      setSelectedProjectId(String(activeProjects[0].id));
    }

    if (!manualForm.project && activeProjects.length > 0) {
      setManualForm((prev) => ({
        ...prev,
        project: String(activeProjects[0].id),
      }));
    }
  }, [activeProjects, selectedProjectId, manualForm.project]);

  async function handleStartWork() {
    if (!access) {
      setErrorMessage("Anmeldedaten fehlen. Bitte melde dich neu an.");
      return;
    }

    if (!membershipData?.company || !membershipData?.id) {
      setErrorMessage(
        "Company or employee membership is missing for this account."
      );
      return;
    }

    if (!selectedProjectId) {
      setErrorMessage("Please select a project before starting work.");
      return;
    }

    try {
      setActionLoading("start");
      setErrorMessage("");
      setSuccessMessage("");

      await startWork(access, {
        company: membershipData.company,
        employee_membership: membershipData.id,
        project: Number(selectedProjectId),
      });

      setSuccessMessage("Workday started successfully.");
      await loadWorktimeData(false);
    } catch (error: any) {
      if (Array.isArray(error?.non_field_errors) && error.non_field_errors[0]) {
        setErrorMessage(error.non_field_errors[0]);
      } else {
        setErrorMessage(error?.detail || "Start work failed.");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEndWork() {
    if (!access) {
      setErrorMessage("Anmeldedaten fehlen. Bitte melde dich neu an.");
      return;
    }

    if (!activeEntry?.public_id) {
      setErrorMessage("No active work entry was found.");
      return;
    }

    try {
      setActionLoading("end");
      setErrorMessage("");
      setSuccessMessage("");

      await endWork(access, activeEntry.public_id);

      setSuccessMessage("Workday ended successfully.");
      await loadWorktimeData(false);
    } catch (error: any) {
      setErrorMessage(error?.detail || "End work failed.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!access) {
      setErrorMessage("Anmeldedaten fehlen. Bitte melde dich neu an.");
      return;
    }

    if (!membershipData?.company || !membershipData?.id) {
      setErrorMessage(
        "Company or employee membership is missing for this account."
      );
      return;
    }

    if (!manualForm.project) {
      setErrorMessage("Please select a project for the manual entry.");
      return;
    }

    if (!manualForm.started_at || !manualForm.ended_at) {
      setErrorMessage("Please enter start and end time for the manual entry.");
      return;
    }

    if (!manualForm.internal_note.trim()) {
      setErrorMessage("A comment is required for manual entries.");
      return;
    }

    try {
      setActionLoading("manual");
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch(`${API_BASE_URL}/worktime/entries/manual/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          company: membershipData.company,
          employee_membership: membershipData.id,
          project: Number(manualForm.project),
          entry_type: "manual",
          work_date: manualForm.started_at.slice(0, 10),
          started_at: fromDateTimeLocalValue(manualForm.started_at),
          ended_at: fromDateTimeLocalValue(manualForm.ended_at),
          break_minutes: Number(manualForm.break_minutes || "0"),
          title: manualForm.title || "",
          description: manualForm.description || "",
          internal_note: manualForm.internal_note.trim(),
        }),
      });

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw data || { detail: "Manual entry creation failed." };
      }

      setSuccessMessage("Manual work entry created successfully.");
      setManualOpen(false);
      setManualForm({
        project: activeProjects[0] ? String(activeProjects[0].id) : "",
        started_at: "",
        ended_at: "",
        internal_note: "",
        break_minutes: "0",
        title: "",
        description: "",
      });

      await loadWorktimeData(false);
    } catch (error: any) {
      if (error?.internal_note?.[0]) {
        setErrorMessage(error.internal_note[0]);
      } else if (error?.started_at?.[0]) {
        setErrorMessage(error.started_at[0]);
      } else if (error?.ended_at?.[0]) {
        setErrorMessage(error.ended_at[0]);
      } else if (error?.work_date?.[0]) {
        setErrorMessage(error.work_date[0]);
      } else if (
        Array.isArray(error?.non_field_errors) &&
        error.non_field_errors[0]
      ) {
        setErrorMessage(error.non_field_errors[0]);
      } else {
        setErrorMessage(error?.detail || "Manual entry creation failed.");
      }
    } finally {
      setActionLoading(null);
    }
  }

  function openEditForm(entry: WorktimeEntry) {
    setEditOpenId(entry.public_id);
    setEditForm({
      public_id: entry.public_id,
      project: entry.project ? String(entry.project) : "",
      started_at: toDateTimeLocalValue(entry.started_at),
      ended_at: toDateTimeLocalValue(entry.ended_at),
      break_minutes: String(entry.break_minutes ?? 0),
      title: entry.title || "",
      description: entry.description || "",
      internal_note: "",
    });
  }

  function closeEditForm() {
    setEditOpenId(null);
    setEditForm({
      public_id: "",
      project: "",
      started_at: "",
      ended_at: "",
      break_minutes: "0",
      title: "",
      description: "",
      internal_note: "",
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!access) {
      setErrorMessage("Anmeldedaten fehlen. Bitte melde dich neu an.");
      return;
    }

    if (!editForm.public_id) {
      setErrorMessage("No entry selected for editing.");
      return;
    }

    if (!editForm.internal_note.trim()) {
      setErrorMessage("A comment is required before saving changes.");
      return;
    }

    try {
      setActionLoading("edit");
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_BASE_URL}/worktime/entries/${editForm.public_id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
          },
          body: JSON.stringify({
            project: editForm.project ? Number(editForm.project) : null,
            work_date: editForm.started_at.slice(0, 10),
            started_at: fromDateTimeLocalValue(editForm.started_at),
            ended_at: fromDateTimeLocalValue(editForm.ended_at),
            break_minutes: Number(editForm.break_minutes || "0"),
            title: editForm.title || "",
            description: editForm.description || "",
            internal_note: editForm.internal_note.trim(),
          }),
        }
      );

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw data || { detail: "Update failed." };
      }

      setSuccessMessage("Worktime entry updated successfully.");
      closeEditForm();
      await loadWorktimeData(false);
    } catch (error: any) {
      if (error?.internal_note?.[0]) {
        setErrorMessage(error.internal_note[0]);
      } else if (error?.started_at?.[0]) {
        setErrorMessage(error.started_at[0]);
      } else if (error?.ended_at?.[0]) {
        setErrorMessage(error.ended_at[0]);
      } else if (error?.work_date?.[0]) {
        setErrorMessage(error.work_date[0]);
      } else if (error?.project?.[0]) {
        setErrorMessage(error.project[0]);
      } else if (error?.detail) {
        setErrorMessage(error.detail);
      } else {
        setErrorMessage("Update failed.");
      }
    } finally {
      setActionLoading(null);
    }
  }

  const canStart = !activeEntry && !pageLoading;
  const canEnd = !!activeEntry && !pageLoading;

  if (!access && authReady) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-700">
            Working time
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Time tracking
          </h1>
          <p className="mt-4 text-sm leading-7 text-red-700">
            Anmeldedaten fehlen. Bitte melde dich neu an.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Working time
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Time tracking for {displayName}
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Start and end your workday, review your current status, and keep your
          daily attendance organized in one place.
        </p>
      </section>

      {successMessage ? (
        <MessageBox type="success" text={successMessage} />
      ) : null}

      {errorMessage ? <MessageBox type="error" text={errorMessage} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Current status"
          value={pageLoading ? "Loading..." : currentStatus}
          helper="Shows whether you currently have an active work session."
        />
        <StatCard
          title="Today"
          value={pageLoading ? "Loading..." : todayWorked}
          helper="Your worked time for today."
        />
        <StatCard
          title="Employee number"
          value={employeeNumber}
          helper="Loaded from your active company membership."
        />
        <StatCard
          title="Department"
          value={department}
          helper="Your current department inside the company."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Monthly target"
          value={formatMinutesToHours(monthlyTargetMinutes)}
          helper="Soll-Stunden / Monat from company membership."
        />
        <StatCard
          title="Approved hours"
          value={formatMinutesToHours(approvedMinutesForSelectedMonth)}
          helper="Only approved hours from the selected month."
        />
        <StatCard
          title="Overtime"
          value={buildOvertimeLabel(overtimeMinutes)}
          helper="Approved hours minus monthly target."
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Daily actions
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Select a project before starting your workday.
          </p>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={!!activeEntry || activeProjects.length === 0}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">Select a project</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {buildProjectLabel(project)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ActionButton
              label="Start work"
              helper="Begin your workday for the selected project."
              disabled={!canStart || !selectedProjectId}
              loading={actionLoading === "start"}
              onClick={handleStartWork}
            />

            <ActionButton
              label="End work"
              helper="Finish your current workday and close the active entry."
              disabled={!canEnd}
              loading={actionLoading === "end"}
              onClick={handleEndWork}
            />
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setManualOpen((prev) => !prev)}
              className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {manualOpen ? "Close manual entry" : "Add manual entry"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Current summary
          </h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Company</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {companyName}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">
                Today&apos;s session
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {activeEntry
                  ? `Started at ${formatTimeLabel(activeEntry.started_at)}`
                  : "No active session"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Live timer</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {activeEntry ? formatSecondsAsHHMMSS(timerSeconds) : "00:00:00"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Selected period</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {selectedMonthValue}
              </p>
            </div>
          </div>
        </div>
      </section>

      {manualOpen ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
              Manual entry
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Add a manual worktime entry
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Use this only when you forgot to start or stop your workday. A
              comment is required.
            </p>
          </div>

          <form
            onSubmit={handleManualSubmit}
            className="mt-6 grid gap-5 lg:grid-cols-2"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Project
              </label>
              <select
                value={manualForm.project}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    project: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                required
              >
                <option value="">Select a project</option>
                {activeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {buildProjectLabel(project)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Break minutes
              </label>
              <input
                type="number"
                min="0"
                value={manualForm.break_minutes}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    break_minutes: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Start time
              </label>
              <input
                type="datetime-local"
                value={manualForm.started_at}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    started_at: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                End time
              </label>
              <input
                type="datetime-local"
                value={manualForm.ended_at}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    ended_at: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Title
              </label>
              <input
                type="text"
                value={manualForm.title}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                placeholder="Optional short title"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Description
              </label>
              <input
                type="text"
                value={manualForm.description}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                placeholder="Optional description"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Comment
              </label>
              <textarea
                value={manualForm.internal_note}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    internal_note: e.target.value,
                  }))
                }
                rows={4}
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                placeholder="Explain why this entry is being added manually."
              />
            </div>

            <div className="lg:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={actionLoading === "manual"}
                className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading === "manual"
                  ? "Saving..."
                  : "Save manual entry"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualOpen(false);
                  setManualForm({
                    project: activeProjects[0] ? String(activeProjects[0].id) : "",
                    started_at: "",
                    ended_at: "",
                    internal_note: "",
                    break_minutes: "0",
                    title: "",
                    description: "",
                  });
                }}
                className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Recent activity
            </h2>

            <p className="mt-2 text-sm leading-7 text-slate-600">
              Choose a month to review your worktime history.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:min-w-[220px]">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Month
              </label>
              <input
                type="month"
                value={selectedMonthValue}
                onChange={(e) => setSelectedMonthValue(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <button
              type="button"
              onClick={() => loadWorktimeData(true)}
              disabled={pageLoading}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pageLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Start
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    End
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Break
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Comment
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {pageLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-sm text-slate-500">
                      Loading worktime records...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-sm text-slate-500">
                      No worktime records found for the selected month.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => {
                    const isEditing = editOpenId === entry.public_id;
                    const isApproved =
                      String(entry.status || "").toLowerCase() === "approved";
                    const isRunning =
                      String(entry.status || "").toLowerCase() === "running";

                    return (
                      <React.Fragment key={entry.public_id || String(entry.id)}>
                        <tr className="border-t border-slate-200">
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {formatDateLabel(getEntryDate(entry))}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {entry.entry_type || "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {entry.project_name || "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {formatTimeLabel(entry.started_at)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {formatTimeLabel(entry.ended_at)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {entry.break_minutes ?? 0} min
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-slate-900">
                            {getEntryHours(entry)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {entry.internal_note || entry.description || "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {getEntryStatus(entry, activeEntry?.id)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            <button
                              type="button"
                              disabled={isApproved || isRunning}
                              onClick={() => openEditForm(entry)}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>

                        {isEditing ? (
                          <tr className="border-t border-slate-100 bg-slate-50/70">
                            <td colSpan={10} className="px-4 py-5">
                              <form
                                onSubmit={handleEditSubmit}
                                className="grid gap-4 lg:grid-cols-2"
                              >
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Project
                                  </label>
                                  <select
                                    value={editForm.project}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        project: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                                  >
                                    <option value="">Select a project</option>
                                    {activeProjects.map((project) => (
                                      <option key={project.id} value={project.id}>
                                        {buildProjectLabel(project)}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Break minutes
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editForm.break_minutes}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        break_minutes: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Start time
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={editForm.started_at}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        started_at: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    End time
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={editForm.ended_at}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        ended_at: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Title
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        title: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Description
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.description}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        description: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                                  />
                                </div>

                                <div className="lg:col-span-2">
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Comment
                                  </label>
                                  <textarea
                                    rows={4}
                                    value={editForm.internal_note}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        internal_note: e.target.value,
                                      }))
                                    }
                                    required
                                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                                    placeholder="Explain why this worktime entry is being changed."
                                  />
                                </div>

                                <div className="lg:col-span-2 flex flex-wrap gap-3">
                                  <button
                                    type="submit"
                                    disabled={actionLoading === "edit"}
                                    className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {actionLoading === "edit"
                                      ? "Saving..."
                                      : "Save changes"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={closeEditForm}
                                    className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}