const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

export type DocumentCategory =
  | "general"
  | "invoice"
  | "receipt"
  | "contract"
  | "sick_note"
  | "vacation_attachment"
  | "other";

export type DocumentVisibility = "private" | "company_admin" | "company_all";

export type DocumentItem = {
  id: number;
  public_id: string;
  company: number | { id?: number; company_name?: string } | null;
  company_name?: string | null;
  employee_membership: number | null;
  employee_full_name?: string | null;
  employee_email?: string | null;
  title: string;
  description?: string | null;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  file?: string | null;
  file_url?: string | null;
  original_filename?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by?: number | null;
  uploaded_by_name?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type DocumentListParams = {
  company?: number | string;
  employee_membership?: number | string;
  category?: DocumentCategory | "";
  visibility?: DocumentVisibility | "";
  mine?: boolean;
};

export type DocumentCreatePayload = {
  company: number;
  employee_membership?: number | null;
  title: string;
  description?: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  file: File;
};

export type DocumentUpdatePayload = {
  company?: number;
  employee_membership?: number | null;
  title?: string;
  description?: string;
  category?: DocumentCategory;
  visibility?: DocumentVisibility;
  file?: File;
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
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function buildJsonHeaders(extra?: HeadersInit): HeadersInit {
  return buildHeaders({
    "Content-Type": "application/json",
    ...extra,
  });
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
    headers: buildJsonHeaders(init?.headers),
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

async function formDataRequest<T>(url: string, formData: FormData, method: "POST" | "PATCH") {
  const response = await fetch(url, {
    method,
    headers: buildHeaders(),
    body: formData,
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

function buildDocumentFormData(
  payload: DocumentCreatePayload | DocumentUpdatePayload
): FormData {
  const formData = new FormData();

  if (payload.company !== undefined) {
    formData.append("company", String(payload.company));
  }

  if (payload.employee_membership !== undefined) {
    if (payload.employee_membership === null) {
      formData.append("employee_membership", "");
    } else {
      formData.append("employee_membership", String(payload.employee_membership));
    }
  }

  if (payload.title !== undefined) {
    formData.append("title", payload.title);
  }

  if (payload.description !== undefined) {
    formData.append("description", payload.description);
  }

  if (payload.category !== undefined) {
    formData.append("category", payload.category);
  }

  if (payload.visibility !== undefined) {
    formData.append("visibility", payload.visibility);
  }

  if ("file" in payload && payload.file instanceof File) {
    formData.append("file", payload.file);
  }

  return formData;
}

export function formatDocumentDate(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDocumentFileSize(value?: number | null): string {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

export function getDocumentCategoryLabel(category?: DocumentCategory | string | null): string {
  switch (category) {
    case "general":
      return "General";
    case "invoice":
      return "Invoice";
    case "receipt":
      return "Receipt";
    case "contract":
      return "Contract";
    case "sick_note":
      return "Sick Note";
    case "vacation_attachment":
      return "Vacation Attachment";
    case "other":
      return "Other";
    default:
      return category || "-";
  }
}

export function getDocumentVisibilityLabel(
  visibility?: DocumentVisibility | string | null
): string {
  switch (visibility) {
    case "private":
      return "Private";
    case "company_admin":
      return "Company Admin";
    case "company_all":
      return "Company All";
    default:
      return visibility || "-";
  }
}

export async function getDocuments(
  params?: DocumentListParams
): Promise<DocumentItem[]> {
  const url = buildUrl("/documents/documents/", {
    company: params?.company,
    employee_membership: params?.employee_membership,
    category: params?.category,
    visibility: params?.visibility,
    mine: params?.mine,
  });

  const data = await apiRequest<DocumentItem[] | { results?: DocumentItem[] }>(url);
  return ensureArrayResponse(data);
}

export async function getDocumentById(id: number | string): Promise<DocumentItem> {
  const url = buildUrl(`/documents/documents/${id}/`);
  return apiRequest<DocumentItem>(url);
}

export async function createDocument(
  payload: DocumentCreatePayload
): Promise<DocumentItem> {
  const url = buildUrl("/documents/documents/");
  const formData = buildDocumentFormData(payload);
  return formDataRequest<DocumentItem>(url, formData, "POST");
}

export async function updateDocument(
  id: number | string,
  payload: DocumentUpdatePayload
): Promise<DocumentItem> {
  const url = buildUrl(`/documents/documents/${id}/`);
  const formData = buildDocumentFormData(payload);
  return formDataRequest<DocumentItem>(url, formData, "PATCH");
}

export async function deleteDocument(id: number | string): Promise<void> {
  const url = buildUrl(`/documents/documents/${id}/`);
  await apiRequest<void>(url, { method: "DELETE" });
}