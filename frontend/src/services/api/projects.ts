import { apiRequest } from "./client";

export type ProjectTypeItem = {
  id: number;
  company: number;
  company_public_id?: string;
  company_name?: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type ProjectItem = {
  id: number;
  public_id: string;
  project_number?: string | null;
  name: string;
  description?: string;
  status?: string;
  is_active?: boolean;

  company?: number;
  company_public_id?: string;
  company_name?: string;

  customer?: number | null;
  customer_public_id?: string | null;
  customer_name?: string | null;

  project_type?: number | null;
  project_type_id?: number | null;
  project_type_name?: string | null;

  site_location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: string | number | null;

  created_by?: number | null;
  created_by_email?: string | null;
  updated_by?: number | null;
  updated_by_email?: string | null;

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

export type ProjectTypeListResponse =
  | ProjectTypeItem[]
  | {
      count?: number;
      next?: string | null;
      previous?: string | null;
      results?: ProjectTypeItem[];
    };

export type GetProjectsParams = {
  token: string;
  companyPublicId?: string;
  search?: string;
  status?: string;
  projectTypeId?: number | string;
  isActive?: string | boolean;
};

export type GetProjectTypesParams = {
  token: string;
  companyPublicId?: string;
  search?: string;
  isActive?: string | boolean;
};

export type ProjectTypePayload = {
  company: number;
  name: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
};

export type ProjectCreatePayload = {
  company: number;
  customer: number;
  name: string;
  description?: string;
  project_number?: string;
  project_type?: number | null;
  site_location?: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  budget?: string | number | null;
  is_active?: boolean;
};

export type ProjectUpdatePayload = Partial<{
  company: number;
  customer: number;
  name: string;
  description: string;
  project_number: string;
  project_type: number | null;
  site_location: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: string | number | null;
  is_active: boolean;
}>;

function buildQuery(params: Record<string, unknown>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getProjectResults(
  response: ProjectListResponse | null | undefined
): ProjectItem[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.results)) return response.results;
  return [];
}

export function getProjectTypeResults(
  response: ProjectTypeListResponse | null | undefined
): ProjectTypeItem[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.results)) return response.results;
  return [];
}

export async function getProjects({
  token,
  companyPublicId,
  search,
  status,
  projectTypeId,
  isActive,
}: GetProjectsParams): Promise<ProjectListResponse> {
  const query = buildQuery({
    company: companyPublicId,
    search,
    status,
    project_type: projectTypeId,
    is_active: typeof isActive === "boolean" ? String(isActive) : isActive,
  });

  return apiRequest(`/projects/${query}`, "GET", undefined, token);
}

export async function getProjectByPublicId(
  token: string,
  publicId: string
): Promise<ProjectItem> {
  return apiRequest(
    `/projects/${encodeURIComponent(publicId)}/`,
    "GET",
    undefined,
    token
  );
}

export async function createProject(
  token: string,
  payload: ProjectCreatePayload
): Promise<ProjectItem> {
  return apiRequest("/projects/", "POST", payload, token);
}

export async function updateProject(
  token: string,
  publicId: string,
  payload: ProjectUpdatePayload
): Promise<ProjectItem> {
  return apiRequest(
    `/projects/${encodeURIComponent(publicId)}/`,
    "PATCH",
    payload,
    token
  );
}

export async function deleteProject(
  token: string,
  publicId: string
): Promise<void> {
  await apiRequest(
    `/projects/${encodeURIComponent(publicId)}/`,
    "DELETE",
    undefined,
    token
  );
}

export async function getProjectTypes({
  token,
  companyPublicId,
  search,
  isActive,
}: GetProjectTypesParams): Promise<ProjectTypeListResponse> {
  const query = buildQuery({
    company: companyPublicId,
    search,
    is_active: typeof isActive === "boolean" ? String(isActive) : isActive,
  });

  return apiRequest(`/projects/project-types/${query}`, "GET", undefined, token);
}

export async function createProjectType(
  token: string,
  payload: ProjectTypePayload
): Promise<ProjectTypeItem> {
  return apiRequest("/projects/project-types/", "POST", payload, token);
}

export async function updateProjectType(
  token: string,
  id: number,
  payload: Partial<ProjectTypePayload>
): Promise<ProjectTypeItem> {
  return apiRequest(`/projects/project-types/${id}/`, "PATCH", payload, token);
}

export async function deleteProjectType(
  token: string,
  id: number
): Promise<void> {
  await apiRequest(
    `/projects/project-types/${id}/`,
    "DELETE",
    undefined,
    token
  );
}

export function getActiveProjects(projects: ProjectItem[]) {
  return projects.filter((project) => project.is_active !== false);
}

export function getActiveProjectTypes(projectTypes: ProjectTypeItem[]) {
  return projectTypes.filter((item) => item.is_active !== false);
}

export function buildProjectLabel(project: ProjectItem) {
  const number = project.project_number?.trim();
  if (number) {
    return `${number} - ${project.name}`;
  }
  return project.name;
}