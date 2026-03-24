const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

export type ProjectItem = {
  id: number;
  public_id: string;
  project_number?: string | null;
  name: string;
  status?: string;
  is_active?: boolean;
  company_public_id?: string;
  company_name?: string;
  customer_public_id?: string | null;
  customer_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProjectListResponse =
  | ProjectItem[]
  | {
      count?: number;
      next?: string | null;
      previous?: string | null;
      results?: ProjectItem[];
    };

async function apiRequest<T>(endpoint: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
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
    throw data || { detail: "Something went wrong." };
  }

  return data as T;
}

export async function getProjects(
  accessToken: string,
  companyPublicId?: string
) {
  const query = companyPublicId
    ? `/projects/?company=${encodeURIComponent(companyPublicId)}`
    : "/projects/";

  return apiRequest<ProjectListResponse>(query, accessToken);
}

export function getProjectResults(
  response: ProjectListResponse | null | undefined
): ProjectItem[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.results)) return response.results;
  return [];
}

export function getActiveProjects(projects: ProjectItem[]) {
  return projects.filter((project) => project.is_active !== false);
}

export function buildProjectLabel(project: ProjectItem) {
  const number = project.project_number?.trim();

  if (number) {
    return `${number} - ${project.name}`;
  }

  return project.name;
}