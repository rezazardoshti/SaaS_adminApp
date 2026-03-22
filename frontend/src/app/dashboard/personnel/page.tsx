"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PersonnelSubnav from "@/components/dashboard/PersonnelSubnav";
import CreateEmployeeModal from "@/components/dashboard/CreateEmployeeModal";
import EditEmployeeModal from "@/components/dashboard/EditEmployeeModal";
import { useAuth } from "@/context/AuthContext";
import {
  createEmployee,
  getEmployeeMembershipDetail,
  getEmployeeUserDetail,
  getEmployees,
  getMyMemberships,
  updateEmployeeMembership,
  updateEmployeeUser,
  type EmployeeMembershipItem,
} from "@/services/api/employees";

type FilterState = {
  search: string;
  role: string;
  isActive: string;
  employmentStatus: string;
  contractType: string;
};

type FlashMessage = {
  type: "success" | "error";
  text: string;
} | null;

function InfoStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warning"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {children}
    </span>
  );
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export default function PersonnelPage() {
  const { access } = useAuth();

  const [items, setItems] = useState<EmployeeMembershipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>("");
  const [flash, setFlash] = useState<FlashMessage>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeMembershipItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("");

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    role: "",
    isActive: "",
    employmentStatus: "",
    contractType: "",
  });

  const loadEmployees = useCallback(async () => {
    if (!access) return;

    setLoading(true);
    setPageError("");

    try {
      const myMemberships = await getMyMemberships(access);
      const currentMembership =
        myMemberships.find((item) => item.is_active) || myMemberships[0];

      if (!currentMembership?.company) {
        throw { detail: "No active company membership found." };
      }

      setCompanyId(currentMembership.company);
      setCurrentRole(currentMembership.role);

      const memberships = await getEmployees({
        token: access,
        companyId: currentMembership.company,
        role: filters.role || undefined,
        isActive: filters.isActive || undefined,
        employmentStatus: filters.employmentStatus || undefined,
        contractType: filters.contractType || undefined,
      });

      setItems(memberships);
    } catch (error: any) {
      setPageError(error?.detail || "Employees could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [access, filters.contractType, filters.employmentStatus, filters.isActive, filters.role]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (!flash) return;

    const timer = window.setTimeout(() => {
      setFlash(null);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !createOpen && !editOpen) {
        await loadEmployees();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [createOpen, editOpen, loadEmployees]);

  const filteredItems = useMemo(() => {
    const search = normalize(filters.search);

    if (!search) return items;

    return items.filter((item) => {
      const fullName = normalize(item.user?.full_name);
      const firstName = normalize(item.user?.first_name);
      const lastName = normalize(item.user?.last_name);
      const email = normalize(item.user?.email);
      const publicId = normalize(item.user?.public_id);
      const employeeNumber = normalize(item.employee_number);
      const department = normalize(item.department);
      const jobTitle = normalize(item.job_title);

      return [
        fullName,
        firstName,
        lastName,
        email,
        publicId,
        employeeNumber,
        department,
        jobTitle,
      ].some((value) => value.includes(search));
    });
  }, [filters.search, items]);

  const stats = useMemo(() => {
    const total = items.length;
    const employees = items.filter((item) => item.role === "employee").length;
    const admins = items.filter((item) => item.role === "admin").length;
    const active = items.filter((item) => item.is_active).length;

    return { total, employees, admins, active };
  }, [items]);

  async function handleCreateEmployee(payload: {
    email: string;
    password: string;
    password_confirm: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role: "owner" | "admin" | "employee";
    department?: string;
    job_title?: string;
    contract_type?:
      | "full_time"
      | "part_time"
      | "mini_job"
      | "working_student"
      | "freelancer"
      | "intern"
      | "temporary";
    employment_status?: "active" | "inactive" | "on_leave" | "terminated";
    entry_date?: string;
    vacation_days_per_year?: number;
    is_time_tracking_enabled?: boolean;
    can_manage_projects?: boolean;
  }) {
    if (!access || !companyId) {
      throw { detail: "Current company could not be detected." };
    }

    setIsCreating(true);

    try {
      await createEmployee(access, {
        company_id: companyId,
        ...payload,
      });

      await loadEmployees();
      setFlash({
        type: "success",
        text: "Employee was created successfully.",
      });
    } catch (error: any) {
      setFlash({
        type: "error",
        text: error?.detail || "Employee could not be created.",
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  }

  async function handleLoadEmployeeDetails(employee: EmployeeMembershipItem) {
    if (!access || !employee.user?.id) {
      throw { detail: "Employee details could not be loaded." };
    }

    const [user, membership] = await Promise.all([
      getEmployeeUserDetail(access, employee.user.id),
      getEmployeeMembershipDetail(access, employee.id),
    ]);

    return { user, membership };
  }

  async function handleUpdateEmployee(payload: {
    employee: EmployeeMembershipItem;
    userData: {
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
    membershipData: {
      role?: "owner" | "admin" | "employee";
      job_title?: string;
      department?: string;
      contract_type?: string;
      employment_status?: string;
      entry_date?: string | null;
      exit_date?: string | null;
      vacation_days_per_year?: number;
      is_time_tracking_enabled?: boolean;
      can_manage_projects?: boolean;
      notes?: string;
      is_active?: boolean;
    };
  }) {
    if (!access || !payload.employee.user?.id) {
      throw { detail: "Employee could not be updated." };
    }

    try {
      await Promise.all([
        updateEmployeeUser(access, payload.employee.user.id, payload.userData),
        updateEmployeeMembership(access, payload.employee.id, payload.membershipData),
      ]);

      await loadEmployees();

      setFlash({
        type: "success",
        text: "Employee data was saved successfully.",
      });

      setEditOpen(false);
      setSelectedEmployee(null);
    } catch (error: any) {
      setFlash({
        type: "error",
        text: error?.detail || "Employee could not be updated.",
      });
      throw error;
    }
  }

  async function handleCloseEditModal() {
    setEditOpen(false);
    setSelectedEmployee(null);
    await loadEmployees();
  }

  return (
    <div className="space-y-6">
      <PersonnelSubnav />

      {flash ? (
        <section
          className={`rounded-2xl border p-4 text-sm font-medium ${
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {flash.text}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Employees</h2>
            <p className="mt-2 text-sm text-slate-600">
              See the employees of the current company, filter them quickly, add
              new people, and edit full employee information.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFlash(null);
              setCreateOpen(true);
            }}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Add employee
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoStat label="All visible people" value={stats.total} />
        <InfoStat label="Employees" value={stats.employees} />
        <InfoStat label="Admins" value={stats.admins} />
        <InfoStat label="Active memberships" value={stats.active} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Name, email, employee no., department..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              value={filters.role}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, role: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="employee">Employee</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Membership status
            </label>
            <select
              value={filters.isActive}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, isActive: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Employment status
            </label>
            <select
              value={filters.employmentStatus}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  employmentStatus: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On leave</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Contract type
            </label>
            <select
              value={filters.contractType}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  contractType: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All contract types</option>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="mini_job">Mini job</option>
              <option value="working_student">Working student</option>
              <option value="freelancer">Freelancer</option>
              <option value="intern">Intern</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">Loading employees...</p>
        </section>
      ) : pageError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h3 className="text-lg font-semibold text-red-800">
            Employees could not be loaded
          </h3>
          <p className="mt-2 text-sm text-red-700">{pageError}</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Person
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee no.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Job title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contract
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-4 py-4 align-top">
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.user?.full_name ||
                              [item.user?.first_name, item.user?.last_name]
                                .filter(Boolean)
                                .join(" ") ||
                              "-"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.user?.email || "-"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {item.user?.public_id || "-"}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-sm font-medium text-slate-900">
                        {item.employee_number || "-"}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <Pill>{item.role}</Pill>
                      </td>

                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {item.department || "-"}
                      </td>

                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {item.job_title || "-"}
                      </td>

                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {item.contract_type || "-"}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          <Pill tone={item.is_active ? "success" : "warning"}>
                            {item.is_active ? "active" : "inactive"}
                          </Pill>

                          {item.employment_status ? (
                            <span className="text-xs text-slate-500">
                              {item.employment_status}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setFlash(null);
                            setSelectedEmployee(item);
                            setEditOpen(true);
                          }}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CreateEmployeeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateEmployee}
        isSubmitting={isCreating}
        canCreateAdmin={currentRole === "owner" || currentRole === "admin"}
      />

      <EditEmployeeModal
        open={editOpen}
        onClose={handleCloseEditModal}
        employee={selectedEmployee}
        canManageAdminRole={currentRole === "owner"}
        loadDetails={handleLoadEmployeeDetails}
        onSubmit={handleUpdateEmployee}
      />
    </div>
  );
}