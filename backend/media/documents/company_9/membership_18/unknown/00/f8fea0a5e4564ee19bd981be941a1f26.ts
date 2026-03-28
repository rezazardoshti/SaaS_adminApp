import { apiRequest } from "./client";

export type WorkTimeStatus = "running" | "submitted" | "approved" | "rejected";
export type WorkTimeEntryType = "timer" | "manual";

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
};

export type EndWorkPayload = {
  ended_at?: string;
  break_minutes?: number;
  title?: string;
  description?: string;
  internal_note?: string;
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
};

export type WorkTimeEntryUpdatePayload = {
  project?: number | null;
  work_date?: string;
  started_at?: string;
  ended_at?: string | null;
  break_minutes?: number;
  title?: string;
  status?:string;
  description?: string;
  internal_note?: string;
  is_active?: boolean;
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

function buildQuery(params: Record<string, string | number | undefined | null>) {
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
      (entry) =>
        entry.status === "running" &&
        entry.is_active &&
        !entry.ended_at
    ) || null
  );
}

export function formatMinutesToHours(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    remainingMinutes
  ).padStart(2, "0")}`;
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
  return apiRequest(
    "/worktime/entries/start/",
    "POST",
    payload,
    token
  ) as Promise<WorktimeEntry>;
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
  return apiRequest(
    "/worktime/entries/manual/",
    "POST",
    payload,
    token
  ) as Promise<WorktimeEntry>;
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
    {
      internal_note: internalNote || "",
    },
    token
  ) as Promise<WorkTimeEntryDetail>;
}