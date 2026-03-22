import { apiRequest } from "./client";

export type EmployeeRole = "owner" | "admin" | "employee";
export type ContractType =
  | "full_time"
  | "part_time"
  | "mini_job"
  | "working_student"
  | "freelancer"
  | "intern"
  | "temporary";
export type EmploymentStatus =
  | "active"
  | "inactive"
  | "on_leave"
  | "terminated";

export type EmployeeMembershipItem = {
  id: number;
  company: number;
  company_name: string;
  company_public_id?: string;
  role: EmployeeRole;
  employee_number?: string;
  job_title?: string;
  department?: string;
  contract_type?: ContractType | string;
  employment_status?: EmploymentStatus | string;
  entry_date?: string | null;
  exit_date?: string | null;
  weekly_target_hours?: string | number | null;
  monthly_target_hours?: string | number | null;
  hourly_wage?: string | number | null;
  vacation_days_per_year?: string | number | null;
  is_time_tracking_enabled?: boolean;
  can_manage_projects?: boolean;
  is_active: boolean;
  joined_at?: string;
  updated_at?: string;
  notes?: string;
  user?: {
    id: number;
    public_id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string;
    gender?: string;
    birth_date?: string | null;
    street?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    country_code?: string;
    emergency_contact_person?: string;
    emergency_contact_phone?: string;
    notes?: string;
    is_active?: boolean;
  };
};

export type EmployeeUserDetail = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  gender?: string;
  phone?: string;
  birth_date?: string | null;
  profile_image?: string | null;
  document?: string | null;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  country_code?: string;
  emergency_contact_person?: string;
  emergency_contact_phone?: string;
  notes?: string;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeMembershipDetail = {
  id: number;
  company: number;
  company_public_id?: string;
  company_name?: string;
  role: EmployeeRole;
  employee_number?: string;
  job_title?: string;
  department?: string;
  contract_type?: ContractType | string;
  employment_status?: EmploymentStatus | string;
  entry_date?: string | null;
  exit_date?: string | null;
  weekly_target_hours?: string | number | null;
  monthly_target_hours?: string | number | null;
  hourly_wage?: string | number | null;
  vacation_days_per_year?: string | number | null;
  is_time_tracking_enabled?: boolean;
  can_manage_projects?: boolean;
  notes?: string;
  is_active?: boolean;
};

export type EmployeeCreatePayload = {
  company_id: number;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: EmployeeRole;
  department?: string;
  job_title?: string;
  contract_type?: ContractType;
  employment_status?: EmploymentStatus;
  entry_date?: string;
  vacation_days_per_year?: number;
  is_time_tracking_enabled?: boolean;
  can_manage_projects?: boolean;
};

export type EmployeeUserUpdatePayload = {
  first_name?: string;
  last_name?: string;
  gender?: string;
  phone?: string;
  birth_date?: string | null;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  emergency_contact_person?: string;
  emergency_contact_phone?: string;
  notes?: string;
};

export type EmployeeMembershipUpdatePayload = {
  role?: EmployeeRole;
  job_title?: string;
  department?: string;
  contract_type?: ContractType | string;
  employment_status?: EmploymentStatus | string;
  entry_date?: string | null;
  exit_date?: string | null;
  vacation_days_per_year?: number | string | null;
  is_time_tracking_enabled?: boolean;
  can_manage_projects?: boolean;
  notes?: string;
  is_active?: boolean;
};

type ListResponse<T> =
  | T[]
  | {
      results?: T[];
      count?: number;
      next?: string | null;
      previous?: string | null;
    }
  | null
  | undefined;

function getItems<T>(value: ListResponse<T>): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.results)) return value.results;
  return [];
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined>
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getMyMemberships(token: string) {
  const response = await apiRequest(
    "/companies/memberships/mine/",
    "GET",
    undefined,
    token
  );
  return getItems<EmployeeMembershipItem>(response);
}

export async function getEmployees(params: {
  token: string;
  companyId: number;
  role?: string;
  isActive?: string;
  employmentStatus?: string;
  contractType?: string;
}) {
  const query = buildQuery({
    company: params.companyId,
    role: params.role,
    is_active: params.isActive,
    employment_status: params.employmentStatus,
    contract_type: params.contractType,
  });

  const response = await apiRequest(
    `/companies/memberships/${query}`,
    "GET",
    undefined,
    params.token
  );

  return getItems<EmployeeMembershipItem>(response);
}

export async function createEmployee(token: string, payload: EmployeeCreatePayload) {
  return apiRequest("/accounts/users/", "POST", payload, token);
}

export async function getEmployeeUserDetail(token: string, userId: number) {
  return apiRequest(`/accounts/users/${userId}/`, "GET", undefined, token) as Promise<EmployeeUserDetail>;
}

export async function updateEmployeeUser(
  token: string,
  userId: number,
  payload: EmployeeUserUpdatePayload
) {
  return apiRequest(`/accounts/users/${userId}/`, "PATCH", payload, token) as Promise<EmployeeUserDetail>;
}

export async function getEmployeeMembershipDetail(token: string, membershipId: number) {
  return apiRequest(
    `/companies/memberships/${membershipId}/`,
    "GET",
    undefined,
    token
  ) as Promise<EmployeeMembershipDetail>;
}

export async function updateEmployeeMembership(
  token: string,
  membershipId: number,
  payload: EmployeeMembershipUpdatePayload
) {
  return apiRequest(
    `/companies/memberships/${membershipId}/`,
    "PATCH",
    payload,
    token
  ) as Promise<EmployeeMembershipDetail>;
}