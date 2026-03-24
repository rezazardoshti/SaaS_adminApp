const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type WorktimeEntry = {
  id: number;
  public_id: string;
  company: number;
  employee_membership: number;
  employee_name?: string;
  project?: number | null;
  project_name?: string;
  entry_type?: string;
  status?: string;
  work_date?: string;
  started_at?: string | null;
  ended_at?: string | null;
  break_minutes?: number | null;
  duration_minutes?: number | null;
  duration_hours?: string | null;
  title?: string;
  description?: string;
  internal_note?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type WorktimeListResponse =
  | WorktimeEntry[]
  | {
      count?: number;
      next?: string | null;
      previous?: string | null;
      results?: WorktimeEntry[];
    };

type StartWorkPayload = {
  company: number;
  employee_membership: number;
  project?: number | null;
  title?: string;
  description?: string;
  internal_note?: string;
};

type StopWorkPayload = {
  break_minutes?: number;
  title?: string;
  description?: string;
  internal_note?: string;
};

async function apiRequest<T>(
  endpoint: string,
  accessToken: string,
  method: RequestMethod = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw data || { detail: "Something went wrong." };
  }

  return data as T;
}

export async function getMyWorktimeEntries(accessToken: string) {
  return apiRequest<WorktimeListResponse>(
    "/worktime/entries/?mine=true",
    accessToken,
    "GET"
  );
}

export async function getMyActiveWorktime(accessToken: string) {
  return apiRequest<WorktimeListResponse>(
    "/worktime/entries/?mine=true&is_active=true&status=running",
    accessToken,
    "GET"
  );
}

export async function startWork(
  accessToken: string,
  payload: StartWorkPayload
) {
  return apiRequest<WorktimeEntry>(
    "/worktime/entries/start/",
    accessToken,
    "POST",
    payload
  );
}

export async function endWork(
  accessToken: string,
  publicId: string,
  payload?: StopWorkPayload
) {
  return apiRequest<WorktimeEntry>(
    `/worktime/entries/${publicId}/stop/`,
    accessToken,
    "POST",
    payload || {}
  );
}

export function getWorktimeResults(
  response: WorktimeListResponse | null | undefined
): WorktimeEntry[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.results)) return response.results;
  return [];
}

export function getFirstActiveEntry(
  response: WorktimeListResponse | null | undefined
): WorktimeEntry | null {
  const results = getWorktimeResults(response);
  return results[0] || null;
}

export function formatMinutesToHours(minutes?: number | null) {
  if (!minutes || minutes <= 0) return "00:00";

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(restMinutes).padStart(
    2,
    "0"
  )}`;
}