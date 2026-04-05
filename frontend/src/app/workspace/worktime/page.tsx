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

type CompanyGpsPolicy = {
  id: number;
  public_id?: string;
  company_name?: string;
  gps_capture_mode?: "off" | "optional" | "required" | string;
  gps_visible_to_admin?: boolean;
  gps_visible_to_employee?: boolean;
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

type ManualFormState = {
  project: string;
  started_at: string;
  ended_at: string;
  internal_note: string;
  break_minutes: string;
  title: string;
  description: string;
};

type StartLocationPayload = {
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_in_accuracy?: number;
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
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
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
      onClick={onClick}
      disabled={disabled || loading}
      className="flex min-h-[112px] w-full flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
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
  const classes =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>
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
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

async function fetchCompanyGpsPolicy(
  token: string,
  companyId: number
): Promise<CompanyGpsPolicy> {
  const response = await fetch(`${API_BASE_URL}/companies/${companyId}/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw data || { detail: "Company settings could not be loaded." };
  }

  return data as CompanyGpsPolicy;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

async function resolveStartLocation(
  gpsMode: string | undefined
): Promise<StartLocationPayload> {
  const normalized = String(gpsMode || "off").toLowerCase();

  if (normalized === "off") {
    return {};
  }

  try {
    const position = await getCurrentPosition();
    return {
      check_in_latitude: Number(position.coords.latitude.toFixed(6)),
      check_in_longitude: Number(position.coords.longitude.toFixed(6)),
      check_in_accuracy: Number(position.coords.accuracy.toFixed(2)),
    };
  } catch (error: any) {
    if (normalized === "required") {
      const message =
        error?.message ||
        "Location is required to start work for this company.";
      throw new Error(message);
    }

    return {};
  }
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
  const [companyPolicy, setCompanyPolicy] = useState<CompanyGpsPolicy | null>(null);

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

  const [manualForm, setManualForm] = useState<ManualFormState>({
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
      (user as any)?.full_name?.trim() ||
      [(user as any)?.first_name, (user as any)?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      (user as any)?.email ||
      "User"
    );
  }, [user]);

  const employeeNumber = membershipData?.employee_number || "-";
  const department = membershipData?.department || "-";
  const companyName = (company as any)?.company_name || membershipData?.company_name || "-";

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
    const activeDate = activeEntry?.work_date || activeEntry?.created_at?.slice(0, 10);

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
            detail: "Company or employee membership is missing for this account.",
          };
        }

        const companyPublicId =
          (company as any)?.public_id || activeMembership.company_public_id;

        const [entriesResponse, activeResponse, projectsResponse, policyResponse] =
          await Promise.all([
            getMyWorktimeEntries({
              token: access,
              companyId: activeMembership.company,
            }),
            getMyActiveWorktime({
              token: access,
              companyId: activeMembership.company,
            }),
            companyPublicId ? getProjects(access, companyPublicId) : Promise.resolve([]),
            fetchCompanyGpsPolicy(access, activeMembership.company),
          ]);

        setEntries(getWorktimeResults(entriesResponse));
        setActiveEntry(activeResponse || null);
        setProjects(getProjectResults(projectsResponse as any));
        setCompanyPolicy(policyResponse);
      } catch (error: any) {
        setErrorMessage(error?.detail || "Worktime data could not be loaded.");
      } finally {
        if (showLoader) {
          setPageLoading(false);
        }
        setAuthReady(true);
      }
    },
    [access, company, membershipData]
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
      setErrorMessage("Company or employee membership is missing for this account.");
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

      const policy =
        companyPolicy || (await fetchCompanyGpsPolicy(access, membershipData.company));
      setCompanyPolicy(policy);

      const gpsMode = String(policy?.gps_capture_mode || "off").toLowerCase();
      const locationPayload = await resolveStartLocation(gpsMode);

      await startWork(access, {
        company: membershipData.company,
        employee_membership: membershipData.id,
        project: Number(selectedProjectId),
        ...locationPayload,
      });

      if (gpsMode === "required") {
        setSuccessMessage("Workday started successfully with GPS location.");
      } else if (gpsMode === "optional" && locationPayload.check_in_latitude) {
        setSuccessMessage("Workday started successfully. GPS location was saved.");
      } else {
        setSuccessMessage("Workday started successfully.");
      }

      await loadWorktimeData(false);
    } catch (error: any) {
      if (Array.isArray(error?.non_field_errors) && error.non_field_errors[0]) {
        setErrorMessage(error.non_field_errors[0]);
      } else {
        setErrorMessage(error?.message || error?.detail || "Start work failed.");
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
      setErrorMessage("Company or employee membership is missing for this account.");
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
      } else if (Array.isArray(error?.non_field_errors) && error.non_field_errors[0]) {
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
  const gpsModeLabel = String(companyPolicy?.gps_capture_mode || "off").toLowerCase();

  if (!access && authReady) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Working time
        </p>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Time tracking
          </h1>
          <p className="mt-4 text-slate-600">
            Anmeldedaten fehlen. Bitte melde dich neu an.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Working time
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Time tracking for {displayName}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Start and end your workday, review your current status, and keep your
          daily attendance organized in one place.
        </p>
      </div>

      {successMessage ? <MessageBox type="success" text={successMessage} /> : null}
      {errorMessage ? <MessageBox type="error" text={errorMessage} /> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title="Company"
          value={companyName}
          helper={`Department: ${department}`}
        />
        <StatCard
          title="Employee No."
          value={employeeNumber}
          helper={`Status: ${String(currentStatus).toUpperCase()}`}
        />
        <StatCard
          title="GPS policy"
          value={gpsModeLabel}
          helper={
            gpsModeLabel === "required"
              ? "Location is required when starting work."
              : gpsModeLabel === "optional"
              ? "Location is sent only when the browser allows it."
              : "Location is not used when starting work."
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActionButton
          label="Start workday"
          helper="Begin a new running entry for the selected project."
          disabled={!canStart || !selectedProjectId}
          onClick={handleStartWork}
          loading={actionLoading === "start"}
        />
        <ActionButton
          label="End workday"
          helper="Stop the current running entry and submit it."
          disabled={!canEnd}
          onClick={handleEndWork}
          loading={actionLoading === "end"}
        />
        <ActionButton
          label={manualOpen ? "Close manual entry" : "Add manual entry"}
          helper="Use manual entry only when you forgot to start or stop your day."
          disabled={pageLoading}
          onClick={() => setManualOpen((prev) => !prev)}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-4">
          <StatCard
            title="Today worked"
            value={todayWorked}
            helper={
              activeEntry
                ? `Started at ${formatTimeLabel(activeEntry.started_at)}`
                : "No active session"
            }
          />
          <StatCard
            title="Live timer"
            value={activeEntry ? formatSecondsAsHHMMSS(timerSeconds) : "00:00:00"}
            helper="Updates every second while a timer is running."
          />
          <StatCard
            title="Approved this month"
            value={formatMinutesToHours(approvedMinutesForSelectedMonth)}
            helper={`Target: ${formatMinutesToHours(monthlyTargetMinutes)}`}
          />
          <StatCard
            title="Balance"
            value={buildOvertimeLabel(overtimeMinutes)}
            helper="Approved hours minus monthly target."
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div>
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

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Selected month
            </label>
            <input
              type="month"
              value={selectedMonthValue}
              onChange={(e) => setSelectedMonthValue(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </div>
        </div>
      </section>

      {manualOpen ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
              Manual entry
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Add a manual worktime entry
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Use this only when you forgot to start or stop your workday. A
              comment is required.
            </p>
          </div>

          <form onSubmit={handleManualSubmit} className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Project
              </label>
              <select
                value={manualForm.project}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, project: e.target.value }))
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
                value={manualForm.title}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, title: e.target.value }))
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
                rows={4}
                value={manualForm.internal_note}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    internal_note: e.target.value,
                  }))
                }
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
                {actionLoading === "manual" ? "Saving..." : "Save manual entry"}
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
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="text-left text-sm font-semibold text-slate-700">
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Start</th>
                <th className="px-3 py-3">End</th>
                <th className="px-3 py-3">Break</th>
                <th className="px-3 py-3">Hours</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    {pageLoading ? "Loading..." : "No worktime entries found."}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const editable =
                    String(entry.status || "").toLowerCase() === "rejected";

                  return (
                    <React.Fragment key={entry.public_id}>
                      <tr className="align-top">
                        <td className="px-3 py-3">{formatDateLabel(getEntryDate(entry))}</td>
                        <td className="px-3 py-3">{entry.project_name || "-"}</td>
                        <td className="px-3 py-3">{formatTimeLabel(entry.started_at)}</td>
                        <td className="px-3 py-3">{formatTimeLabel(entry.ended_at)}</td>
                        <td className="px-3 py-3">{entry.break_minutes ?? 0} min</td>
                        <td className="px-3 py-3">{getEntryHours(entry)}</td>
                        <td className="px-3 py-3">
                          {getEntryStatus(entry, activeEntry?.id)}
                        </td>
                        <td className="px-3 py-3">
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => openEditForm(entry)}
                              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>

                      {editOpenId === entry.public_id ? (
                        <tr>
                          <td colSpan={8} className="px-3 pb-4">
                            <form
                              onSubmit={handleEditSubmit}
                              className="mt-2 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2"
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
                                  required
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
                                  required
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                  Title
                                </label>
                                <input
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
                                  placeholder="Explain what was changed."
                                />
                              </div>

                              <div className="lg:col-span-2 flex flex-wrap gap-3">
                                <button
                                  type="submit"
                                  disabled={actionLoading === "edit"}
                                  className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {actionLoading === "edit" ? "Saving..." : "Save changes"}
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
      </section>
    </div>
  );
}