const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

export type VacationStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type VacationLeaveType = "annual" | "special" | "unpaid";

export type VacationRequestItem = {
  id: number;
  public_id: string;
  company?: number | { id?: number; name?: string } | null;
  company_id?: number | null;
  company_name?: string | null;
  employee_membership: number;
  employee_name?: string | null;
  employee_number?: string | null;
  requested_by_email?: string | null;
  approved_by_email?: string | null;
  leave_type: VacationLeaveType;
  status: VacationStatus;
  start_date: string;
  end_date: string;
  is_half_day_start: boolean;
  is_half_day_end: boolean;
  requested_days?: string | number | null;
  reason?: string | null;
  employee_note?: string | null;
  manager_note?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  cancelled_at?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type VacationBalanceItem = {
  id: number;
  company?: number | { id?: number; name?: string } | null;
  employee_membership: number;
  employee_name?: string | null;
  employee_number?: string | null;
  year: number;
  entitled_days?: string | number | null;
  base_entitlement_days?: string | number | null;
  carried_over_days?: string | number | null;
  manual_adjustment_days?: string | number | null;
  total_available_days?: string | number | null;
  used_days?: string | number | null;
  remaining_days?: string | number | null;
  note?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type VacationRequestPayload = {
  company: number;
  employee_membership: number;
  leave_type: VacationLeaveType;
  start_date: string;
  end_date: string;
  is_half_day_start?: boolean;
  is_half_day_end?: boolean;
  reason?: string;
  employee_note?: string;
  manager_note?: string;
  status?: VacationStatus;
};

export type VacationDecisionPayload = {
  manager_note?: string;
};

export type VacationListParams = {
  company?: number | string;
  employee_membership?: number | string;
  status?: VacationStatus | "";
  leave_type?: VacationLeaveType | "";
  start_date?: string;
  end_date?: string;
  mine?: boolean;
};

export type VacationBalanceParams = {
  company?: number | string;
  employee_membership?: number | string;
  year?: number | string;
  mine?: boolean;
};

type ApiErrorPayload =
  | string
  | string[]
  | Record<string, unknown>
  | null
  | undefined;

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  const directToken = window.localStorage.getItem("access");
  if (directToken) return directToken;

  const authStorage = window.localStorage.getItem("auth");
  if (!authStorage) return null;

  try {
    const parsed = JSON.parse(authStorage) as {
      access?: string;
      token?: string;
      accessToken?: string;
    };

    return parsed.access || parsed.token || parsed.accessToken || null;
  } catch {
    return null;
  }
}

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAccessToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const base = `${API_BASE_URL.replace(/\/$/, "")}${path}`;
  const url = new URL(base);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        value === false
      ) {
        continue;
      }

      if (typeof value === "boolean") {
        url.searchParams.set(key, value ? "true" : "false");
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function normalizeErrorMessage(payload: ApiErrorPayload, fallback: string): string {
  if (!payload) return fallback;

  if (typeof payload === "string") return payload;

  if (Array.isArray(payload)) {
    return payload.join(", ") || fallback;
  }

  if (typeof payload === "object") {
    const firstValue = Object.values(payload)[0];

    if (typeof firstValue === "string") return firstValue;

    if (Array.isArray(firstValue)) {
      const firstText = firstValue.find((item) => typeof item === "string");
      if (typeof firstText === "string") return firstText;
    }

    if ("detail" in payload && typeof payload.detail === "string") {
      return payload.detail;
    }
  }

  return fallback;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: buildHeaders(init?.headers),
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: ApiErrorPayload = null;

    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }

    throw new Error(
      normalizeErrorMessage(payload, `Request failed with status ${response.status}`)
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function ensureArrayResponse<T>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }
  return 0;
}

export function formatVacationDays(
  value: string | number | null | undefined
): string {
  return toNumber(value).toFixed(2);
}

export function formatVacationDate(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getVacationStatusLabel(status?: VacationStatus | string | null): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "-";
  }
}

export function getVacationLeaveTypeLabel(
  leaveType?: VacationLeaveType | string | null
): string {
  switch (leaveType) {
    case "annual":
      return "Annual Leave";
    case "special":
      return "Special Leave";
    case "unpaid":
      return "Unpaid Leave";
    default:
      return leaveType || "-";
  }
}

export async function getVacationRequests(
  params?: VacationListParams
): Promise<VacationRequestItem[]> {
  const url = buildUrl("/vacations/requests/", {
    company: params?.company,
    employee_membership: params?.employee_membership,
    status: params?.status,
    leave_type: params?.leave_type,
    start_date: params?.start_date,
    end_date: params?.end_date,
    mine: params?.mine,
  });

  const data = await apiRequest<VacationRequestItem[] | { results?: VacationRequestItem[] }>(url);
  return ensureArrayResponse(data);
}

export async function getVacationRequestById(
  id: number | string
): Promise<VacationRequestItem> {
  const url = buildUrl(`/vacations/requests/${id}/`);
  return apiRequest<VacationRequestItem>(url);
}

export async function createVacationRequest(
  payload: VacationRequestPayload
): Promise<VacationRequestItem> {
  const url = buildUrl("/vacations/requests/");
  return apiRequest<VacationRequestItem>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVacationRequest(
  id: number | string,
  payload: Partial<VacationRequestPayload>
): Promise<VacationRequestItem> {
  const url = buildUrl(`/vacations/requests/${id}/`);
  return apiRequest<VacationRequestItem>(url, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteVacationRequest(id: number | string): Promise<void> {
  const url = buildUrl(`/vacations/requests/${id}/`);
  await apiRequest<void>(url, { method: "DELETE" });
}

export async function submitVacationRequest(
  id: number | string,
  payload?: { employee_note?: string }
): Promise<VacationRequestItem> {
  const url = buildUrl(`/vacations/requests/${id}/submit/`);
  return apiRequest<VacationRequestItem>(url, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function approveVacationRequest(
  id: number | string,
  payload?: VacationDecisionPayload
): Promise<VacationRequestItem> {
  const url = buildUrl(`/vacations/requests/${id}/approve/`);
  return apiRequest<VacationRequestItem>(url, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function rejectVacationRequest(
  id: number | string,
  payload?: VacationDecisionPayload
): Promise<VacationRequestItem> {
  const url = buildUrl(`/vacations/requests/${id}/reject/`);
  return apiRequest<VacationRequestItem>(url, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function cancelVacationRequest(
  id: number | string,
  payload?: { employee_note?: string }
): Promise<VacationRequestItem> {
  const url = buildUrl(`/vacations/requests/${id}/cancel/`);
  return apiRequest<VacationRequestItem>(url, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function getVacationBalances(
  params?: VacationBalanceParams
): Promise<VacationBalanceItem[]> {
  const url = buildUrl("/vacations/balances/", {
    company: params?.company,
    employee_membership: params?.employee_membership,
    year: params?.year,
    mine: params?.mine,
  });

  const data = await apiRequest<VacationBalanceItem[] | { results?: VacationBalanceItem[] }>(url);
  return ensureArrayResponse(data);
}

export function getYearOptions(
  aroundYear = new Date().getFullYear(),
  range = 3
): number[] {
  const years: number[] = [];

  for (let year = aroundYear - range; year <= aroundYear + range; year += 1) {
    years.push(year);
  }

  return years;
}

export function sortVacationRequestsByDate(
  items: VacationRequestItem[]
): VacationRequestItem[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.start_date).getTime();
    const bTime = new Date(b.start_date).getTime();
    return bTime - aTime;
  });
}