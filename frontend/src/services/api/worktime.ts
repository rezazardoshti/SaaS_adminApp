import { apiRequest } from "./client";

export type WorkTimeStatus = "running" | "submitted" | "approved" | "rejected";
export type WorkTimeEntryType = "timer" | "manual";

export type GpsCoordinates = {
  latitude: number | null;
  longitude: number | null;
  accuracy_meters?: number | null;
  location_captured_at?: string | null;
};

export type WorktimeEntry = {
  id: number;
  public_id: string;
  company: number;
  employee_membership: number;
  employee_name?: string;

  project: number | null;
  project_name?: string;

  entry_type: WorkTimeEntryType;
  status: WorkTimeStatus;

  work_date: string;
  started_at: string;
  ended_at: string | null;
  break_minutes: number;
  duration_minutes: number;
  duration_hours: string | number;

  title: string;
  description: string;
  internal_note: string;

  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: number | null;
  approved_by_name?: string;
  rejected_at?: string | null;
  rejected_by?: number | null;
  rejected_by_name?: string;

  is_active: boolean;
  created_at: string;
  updated_at: string;

  /**
   * GPS / Standort
   * Diese Felder greifen nur, wenn dein Backend sie bereits liefert.
   */
  gps_enabled_for_company?: boolean;
  gps_required?: boolean;
  has_location?: boolean;

  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  location_captured_at?: string | null;

  start_latitude?: number | null;
  start_longitude?: number | null;
  start_accuracy_meters?: number | null;
  start_location_captured_at?: string | null;

  end_latitude?: number | null;
  end_longitude?: number | null;
  end_accuracy_meters?: number | null;
  end_location_captured_at?: string | null;

  location_label?: string;
};

export type WorkTimeEntryListItem = WorktimeEntry;
export type WorkTimeEntryDetail = WorktimeEntry;

export type StartWorkPayload = {
  company: number;
  employee_membership?: number;
  project?: number | null;
  started_at?: string;
  work_date?: string;
  title?: string;
  description?: string;
  internal_note?: string;

  /**
   * GPS beim Start
   */
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  location_captured_at?: string | null;
};

export type EndWorkPayload = {
  ended_at?: string;
  break_minutes?: number;
  title?: string;
  description?: string;
  internal_note?: string;

  /**
   * GPS beim Stop
   */
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  location_captured_at?: string | null;
};

export type ManualWorktimePayload = {
  company: number;
  employee_membership?: number;
  project?: number | null;
  work_date: string;
  started_at: string;
  ended_at: string;
  break_minutes?: number;
  title?: string;
  description?: string;
  internal_note?: string;
  is_active?: boolean;

  /**
   * GPS bei manueller Erfassung
   */
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  location_captured_at?: string | null;
};

export type WorkTimeEntryUpdatePayload = {
  project?: number | null;
  work_date?: string;
  started_at?: string;
  ended_at?: string | null;
  break_minutes?: number;
  title?: string;
  status?: string;
  description?: string;
  internal_note?: string;
  is_active?: boolean;

  /**
   * Falls Admin oder System GPS-Daten nachträgt/aktualisiert
   */
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  location_captured_at?: string | null;
};

type PaginatedResponse<T> =
  | T[]
  | {
      results?: T[];
      count?: number;
      next?: string | null;
      previous?: string | null;
    }
  | null
  | undefined;

function buildQuery(params: Record<string, unknown>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getWorktimeResults(
  value: PaginatedResponse<WorktimeEntry>
): WorktimeEntry[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.results)) return value.results;
  return [];
}

export function getFirstActiveEntry(entries: WorktimeEntry[]) {
  return (
    entries.find(
      (entry) => entry.status === "running" && entry.is_active && !entry.ended_at
    ) || null
  );
}

export function formatMinutesToHours(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(
    2,
    "0"
  )}`;
}

export function hasGpsLocation(entry?: Partial<WorktimeEntry> | null): boolean {
  if (!entry) return false;

  const direct =
    typeof entry.latitude === "number" && typeof entry.longitude === "number";

  const start =
    typeof entry.start_latitude === "number" &&
    typeof entry.start_longitude === "number";

  const end =
    typeof entry.end_latitude === "number" &&
    typeof entry.end_longitude === "number";

  return Boolean(entry.has_location || direct || start || end);
}

export function getBestGpsCoordinates(
  entry?: Partial<WorktimeEntry> | null
): GpsCoordinates | null {
  if (!entry) return null;

  if (
    typeof entry.latitude === "number" &&
    typeof entry.longitude === "number"
  ) {
    return {
      latitude: entry.latitude,
      longitude: entry.longitude,
      accuracy_meters: entry.accuracy_meters ?? null,
      location_captured_at: entry.location_captured_at ?? null,
    };
  }

  if (
    typeof entry.end_latitude === "number" &&
    typeof entry.end_longitude === "number"
  ) {
    return {
      latitude: entry.end_latitude,
      longitude: entry.end_longitude,
      accuracy_meters: entry.end_accuracy_meters ?? null,
      location_captured_at: entry.end_location_captured_at ?? null,
    };
  }

  if (
    typeof entry.start_latitude === "number" &&
    typeof entry.start_longitude === "number"
  ) {
    return {
      latitude: entry.start_latitude,
      longitude: entry.start_longitude,
      accuracy_meters: entry.start_accuracy_meters ?? null,
      location_captured_at: entry.start_location_captured_at ?? null,
    };
  }

  return null;
}

/**
 * Workspace page helpers
 */
export async function getMyWorktimeEntries(params: {
  token: string;
  companyId?: number;
  status?: string;
  entryType?: string;
  workDateFrom?: string;
  workDateTo?: string;
  isActive?: string;
  search?: string;
}) {
  const query = buildQuery({
    mine: "true",
    company: params.companyId,
    status: params.status,
    entry_type: params.entryType,
    work_date_from: params.workDateFrom,
    work_date_to: params.workDateTo,
    is_active: params.isActive,
    search: params.search,
  });

  const response = await apiRequest(
    `/worktime/entries/${query}`,
    "GET",
    undefined,
    params.token
  );

  return response as PaginatedResponse<WorktimeEntry>;
}

export async function getMyActiveWorktime(params: {
  token: string;
  companyId?: number;
}) {
  const response = await getMyWorktimeEntries({
    token: params.token,
    companyId: params.companyId,
    status: "running",
    isActive: "true",
  });

  const entries = getWorktimeResults(response);
  return getFirstActiveEntry(entries);
}

export async function startWork(token: string, payload: StartWorkPayload) {
  return apiRequest("/worktime/entries/start/", "POST", payload, token) as Promise<WorktimeEntry>;
}

export async function endWork(
  token: string,
  publicId: string,
  payload?: EndWorkPayload
) {
  return apiRequest(
    `/worktime/entries/${encodeURIComponent(publicId)}/stop/`,
    "POST",
    payload || {},
    token
  ) as Promise<WorktimeEntry>;
}

export async function createManualWorktime(
  token: string,
  payload: ManualWorktimePayload
) {
  return apiRequest("/worktime/entries/manual/", "POST", payload, token) as Promise<WorktimeEntry>;
}

/**
 * Shared helpers for admin / personnel page
 */
export async function getWorktimeEntries(params: {
  token: string;
  companyId?: number;
  employeeMembershipId?: number | string;
  status?: string;
  entryType?: string;
  projectId?: number | string;
  workDateFrom?: string;
  workDateTo?: string;
  isActive?: string;
  search?: string;
  mine?: boolean;
}) {
  const query = buildQuery({
    company: params.companyId,
    employee_membership: params.employeeMembershipId,
    status: params.status,
    entry_type: params.entryType,
    project: params.projectId,
    work_date_from: params.workDateFrom,
    work_date_to: params.workDateTo,
    is_active: params.isActive,
    search: params.search,
    mine: params.mine ? "true" : undefined,
  });

  const response = await apiRequest(
    `/worktime/entries/${query}`,
    "GET",
    undefined,
    params.token
  );

  return getWorktimeResults(response as PaginatedResponse<WorktimeEntry>);
}

export async function getWorktimeEntryDetail(token: string, publicId: string) {
  return apiRequest(
    `/worktime/entries/${encodeURIComponent(publicId)}/`,
    "GET",
    undefined,
    token
  ) as Promise<WorkTimeEntryDetail>;
}

export async function updateWorktimeEntry(
  token: string,
  publicId: string,
  payload: WorkTimeEntryUpdatePayload
) {
  return apiRequest(
    `/worktime/entries/${encodeURIComponent(publicId)}/`,
    "PATCH",
    payload,
    token
  ) as Promise<WorkTimeEntryDetail>;
}

export async function approveWorktimeEntry(token: string, publicId: string) {
  return apiRequest(
    `/worktime/entries/${encodeURIComponent(publicId)}/approve/`,
    "POST",
    {},
    token
  ) as Promise<WorkTimeEntryDetail>;
}

export async function rejectWorktimeEntry(
  token: string,
  publicId: string,
  internalNote?: string
) {
  return apiRequest(
    `/worktime/entries/${encodeURIComponent(publicId)}/reject/`,
    "POST",
    { internal_note: internalNote || "" },
    token
  ) as Promise<WorkTimeEntryDetail>;
}