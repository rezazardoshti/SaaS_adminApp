import { apiRequest } from "./client";

export type DashboardMembership = {
  id: number;
  company: number;
  company_name: string;
  company_public_id?: string;
  role: "owner" | "admin" | "employee";
  employee_number?: string;
  job_title?: string;
  department?: string;
  contract_type?: string;
  employment_status?: string;
  vacation_days_per_year?: string | number | null;
  is_time_tracking_enabled?: boolean;
  can_manage_projects?: boolean;
  is_active: boolean;
  user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
    is_active?: boolean;
  };
};

export type DashboardCompany = {
  id: number;
  public_id?: string;
  company_name: string;
  industry?: string;
  employee_range?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  country?: string;
  subscription_plan?: string;
  subscription_status?: string;
  is_trial_active?: boolean;
  is_active?: boolean;
  member_count?: number;
  memberships?: DashboardMembership[];
};

export type DashboardStats = {
  activeEmployees: number;
  admins: number;
  owners: number;
  activeProjects: number;
  openInvoices: number;
  pendingVacations: number;
  documentCount: number;
  worktimeEntries: number;
};

export type DashboardAlert = {
  id: string;
  title: string;
  value: string;
  tone: "neutral" | "warning" | "success";
};

export type DashboardActivity = {
  id: string;
  title: string;
  meta: string;
};

export type DashboardPayload = {
  membership: DashboardMembership | null;
  company: DashboardCompany | null;
  stats: DashboardStats;
  alerts: DashboardAlert[];
  activities: DashboardActivity[];
};

type CollectionResponse<T = any> =
  | T[]
  | {
      results?: T[];
      count?: number;
      next?: string | null;
      previous?: string | null;
    }
  | null
  | undefined;

function getItems<T = any>(input: CollectionResponse<T>): T[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.results)) return input.results;
  return [];
}

function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isOpenInvoice(item: any): boolean {
  const status = normalizeText(item?.status);
  return !["paid", "cancelled", "canceled", "void", "completed"].includes(status);
}

function isPendingVacation(item: any): boolean {
  const status = normalizeText(item?.status);
  return ["pending", "requested", "submitted", "waiting"].includes(status);
}

function isActiveProject(item: any): boolean {
  const status = normalizeText(item?.status);
  if (!status) return true;
  return ["active", "open", "in_progress", "in progress", "ongoing"].includes(status);
}

function buildActivities(params: {
  company: DashboardCompany | null;
  pendingVacations: number;
  openInvoices: number;
  activeProjects: number;
  documentCount: number;
  activeEmployees: number;
}): DashboardActivity[] {
  const {
    company,
    pendingVacations,
    openInvoices,
    activeProjects,
    documentCount,
    activeEmployees,
  } = params;

  const items: DashboardActivity[] = [];

  if (company?.company_name) {
    items.push({
      id: "company",
      title: `Company workspace loaded for ${company.company_name}`,
      meta: company.public_id ? `Company ID: ${company.public_id}` : "Company data is available",
    });
  }

  items.push({
    id: "employees",
    title: `${activeEmployees} active employees in this company`,
    meta: "Based on company memberships",
  });

  items.push({
    id: "vacations",
    title: `${pendingVacations} vacation requests need attention`,
    meta: "Check approvals to keep planning stable",
  });

  items.push({
    id: "projects",
    title: `${activeProjects} active projects currently visible`,
    meta: "Operational workload overview",
  });

  items.push({
    id: "invoices",
    title: `${openInvoices} invoices still open`,
    meta: "Follow-up and accounting visibility",
  });

  items.push({
    id: "documents",
    title: `${documentCount} documents available`,
    meta: "Files and records connected to this workspace",
  });

  return items.slice(0, 5);
}

export async function getDashboardData(token: string): Promise<DashboardPayload> {
  const membershipsResponse = await apiRequest(
    "/companies/memberships/mine/",
    "GET",
    undefined,
    token
  );

  const myMemberships = getItems<DashboardMembership>(membershipsResponse);
  const activeMemberships = myMemberships.filter((item) => item?.is_active);

  const membership = activeMemberships[0] ?? myMemberships[0] ?? null;

  if (!membership?.company) {
    return {
      membership: null,
      company: null,
      stats: {
        activeEmployees: 0,
        admins: 0,
        owners: 0,
        activeProjects: 0,
        openInvoices: 0,
        pendingVacations: 0,
        documentCount: 0,
        worktimeEntries: 0,
      },
      alerts: [
        {
          id: "no-membership",
          title: "No active company membership was found",
          value: "Please check the account-company assignment in backend.",
          tone: "warning",
        },
      ],
      activities: [],
    };
  }

  const companyId = membership.company;

  const [
    companyResult,
    worktimeResult,
    vacationsResult,
    documentsResult,
    projectsResult,
    invoicesResult,
  ] = await Promise.allSettled([
    apiRequest(`/companies/${companyId}/`, "GET", undefined, token),
    apiRequest("/worktime/entries/", "GET", undefined, token),
    apiRequest("/v1/vacations/requests/", "GET", undefined, token),
    apiRequest("/v1/documents/documents/", "GET", undefined, token),
    apiRequest("/projects/", "GET", undefined, token),
    apiRequest("/invoices/", "GET", undefined, token),
  ]);

  const company =
    companyResult.status === "fulfilled" ? (companyResult.value as DashboardCompany) : null;

  const memberships = company?.memberships ?? [];

  const activeEmployees = memberships.filter(
    (item) =>
      item.is_active &&
      normalizeText(item.employment_status) !== "terminated" &&
      normalizeText(item.role) === "employee"
  ).length;

  const admins = memberships.filter(
    (item) => item.is_active && normalizeText(item.role) === "admin"
  ).length;

  const owners = memberships.filter(
    (item) => item.is_active && normalizeText(item.role) === "owner"
  ).length;

  const worktimeEntries =
    worktimeResult.status === "fulfilled"
      ? getItems(worktimeResult.value).length
      : 0;

  const vacationItems =
    vacationsResult.status === "fulfilled"
      ? getItems(vacationsResult.value)
      : [];

  const documentItems =
    documentsResult.status === "fulfilled"
      ? getItems(documentsResult.value)
      : [];

  const projectItems =
    projectsResult.status === "fulfilled"
      ? getItems(projectsResult.value)
      : [];

  const invoiceItems =
    invoicesResult.status === "fulfilled"
      ? getItems(invoicesResult.value)
      : [];

  const pendingVacations = vacationItems.filter(isPendingVacation).length;
  const documentCount = documentItems.length;
  const activeProjects = projectItems.filter(isActiveProject).length;
  const openInvoices = invoiceItems.filter(isOpenInvoice).length;

  const alerts: DashboardAlert[] = [
    {
      id: "vacations",
      title: "Pending vacation requests",
      value: String(pendingVacations),
      tone: pendingVacations > 0 ? "warning" : "success",
    },
    {
      id: "invoices",
      title: "Open invoices",
      value: String(openInvoices),
      tone: openInvoices > 0 ? "warning" : "neutral",
    },
    {
      id: "projects",
      title: "Active projects",
      value: String(activeProjects),
      tone: "neutral",
    },
    {
      id: "documents",
      title: "Documents in workspace",
      value: String(documentCount),
      tone: "neutral",
    },
  ];

  const activities = buildActivities({
    company,
    pendingVacations,
    openInvoices,
    activeProjects,
    documentCount,
    activeEmployees,
  });

  return {
    membership,
    company,
    stats: {
      activeEmployees,
      admins,
      owners,
      activeProjects,
      openInvoices,
      pendingVacations,
      documentCount,
      worktimeEntries: asNumber(worktimeEntries),
    },
    alerts,
    activities,
  };
}