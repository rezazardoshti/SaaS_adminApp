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
  type EmployeeCreatePayload,
  type EmployeeMembershipItem,
  type EmployeeMembershipUpdatePayload,
  type EmployeeUserUpdatePayload,
} from "@/services/api/employees";
import {
  getWorktimeEntries,
  getBestGpsCoordinates,
  hasGpsLocation,
  type WorktimeEntry,
  type GpsCoordinates,
} from "@/services/api/worktime";

type FilterState = {
  search: string;
  role: string;
  isActive: string;
  employmentStatus: string;
  contractType: string;
};

type FlashMessage =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

type EmployeeGpsMap = Record<
  number,
  {
    entry: WorktimeEntry | null;
    coords: GpsCoordinates | null;
  }
>;

function InfoStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warning"
      ? "bg-amber-100 text-amber-700"
      : tone === "danger"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      {children}
    </span>
  );
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatPersonName(item: EmployeeMembershipItem) {
  return (
    item.user?.full_name ||
    [item.user?.first_name, item.user?.last_name].filter(Boolean).join(" ") ||
    "-"
  );
}

function formatCoordinate(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toFixed(6);
}

function formatGpsTimestamp(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildGoogleMapsUrl(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return "";
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function GpsCell({
  gps,
}: {
  gps?: {
    entry: WorktimeEntry | null;
    coords: GpsCoordinates | null;
  };
}) {
  if (!gps?.entry || !gps.coords || !hasGpsLocation(gps.entry)) {
    return (
      <div className="space-y-2">
        <Pill tone="warning">No location</Pill>
        <div className="text-xs text-slate-400">No GPS data available yet</div>
      </div>
    );
  }

  const { coords, entry } = gps;
  const mapsUrl = buildGoogleMapsUrl(coords.latitude, coords.longitude);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Pill tone="success">GPS available</Pill>
        <Pill>{entry.status}</Pill>
      </div>

      <div className="text-xs leading-5 text-slate-600">
        <div>
          <span className="font-medium text-slate-700">Lat:</span>{" "}
          {formatCoordinate(coords.latitude)}
        </div>
        <div>
          <span className="font-medium text-slate-700">Lng:</span>{" "}
          {formatCoordinate(coords.longitude)}
        </div>
        <div>
          <span className="font-medium text-slate-700">Accuracy:</span>{" "}
          {typeof coords.accuracy_meters === "number"
            ? `${Math.round(coords.accuracy_meters)} m`
            : "-"}
        </div>
        <div>
          <span className="font-medium text-slate-700">Captured:</span>{" "}
          {formatGpsTimestamp(coords.location_captured_at)}
        </div>
      </div>

      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Open in Maps
        </a>
      ) : null}
    </div>
  );
}

export default function PersonnelPage() {
  const { access } = useAuth();

  const [items, setItems] = useState<EmployeeMembershipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [flash, setFlash] = useState<FlashMessage>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeMembershipItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [currentRole, setCurrentRole] = useState("");
  const [gpsByMembershipId, setGpsByMembershipId] = useState<EmployeeGpsMap>({});
  const [gpsLoading, setGpsLoading] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    role: "",
    isActive: "",
    employmentStatus: "",
    contractType: "",
  });

  const canSeeGps = useMemo(() => {
    const role = currentRole.toLowerCase();
    return role === "owner" || role === "admin";
  }, [currentRole]);

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
  }, [
    access,
    filters.contractType,
    filters.employmentStatus,
    filters.isActive,
    filters.role,
  ]);

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

  useEffect(() => {
    async function loadGpsData() {
      if (!access || !companyId || !canSeeGps || items.length === 0) {
        setGpsByMembershipId({});
        return;
      }

      setGpsLoading(true);

      try {
        const results = await Promise.all(
          items.map(async (employee) => {
            try {
              const entries = await getWorktimeEntries({
                token: access,
                companyId,
                employeeMembershipId: employee.id,
              });

              const sorted = [...entries].sort((a, b) => {
                const aTime = new Date(
                  a.location_captured_at ||
                    a.end_location_captured_at ||
                    a.start_location_captured_at ||
                    a.updated_at ||
                    a.created_at
                ).getTime();

                const bTime = new Date(
                  b.location_captured_at ||
                    b.end_location_captured_at ||
                    b.start_location_captured_at ||
                    b.updated_at ||
                    b.created_at
                ).getTime();

                return bTime - aTime;
              });

              const latestWithGps =
                sorted.find((entry) => hasGpsLocation(entry)) || null;

              return {
                membershipId: employee.id,
                entry: latestWithGps,
                coords: latestWithGps ? getBestGpsCoordinates(latestWithGps) : null,
              };
            } catch {
              return {
                membershipId: employee.id,
                entry: null,
                coords: null,
              };
            }
          })
        );

        const nextMap: EmployeeGpsMap = {};
        for (const row of results) {
          nextMap[row.membershipId] = {
            entry: row.entry,
            coords: row.coords,
          };
        }

        setGpsByMembershipId(nextMap);
      } finally {
        setGpsLoading(false);
      }
    }

    loadGpsData();
  }, [access, canSeeGps, companyId, items]);

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

      const gps = gpsByMembershipId[item.id];
      const lat = normalize(gps?.coords?.latitude);
      const lng = normalize(gps?.coords?.longitude);

      return [
        fullName,
        firstName,
        lastName,
        email,
        publicId,
        employeeNumber,
        department,
        jobTitle,
        lat,
        lng,
      ].some((value) => value.includes(search));
    });
  }, [filters.search, gpsByMembershipId, items]);

  const stats = useMemo(() => {
    const total = items.length;
    const employees = items.filter((item) => item.role === "employee").length;
    const admins = items.filter((item) => item.role === "admin").length;
    const active = items.filter((item) => item.is_active).length;
    const withGps = items.filter((item) => {
      const gps = gpsByMembershipId[item.id];
      return gps?.entry && gps.coords && hasGpsLocation(gps.entry);
    }).length;

    return { total, employees, admins, active, withGps };
  }, [gpsByMembershipId, items]);

  async function handleCreateEmployee(payload: Omit<EmployeeCreatePayload, "company_id">) {
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
    employee: EmployeeMembershipItem | null;
    userData: EmployeeUserUpdatePayload;
    membershipData: EmployeeMembershipUpdatePayload;
  }) {
    if (!access || !payload.employee?.user?.id) {
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
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              See the employees of the current company, filter them quickly,
              add new people, edit employee information, and review the latest
              GPS position when company GPS is active.
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InfoStat label="Total memberships" value={stats.total} />
        <InfoStat label="Employees" value={stats.employees} />
        <InfoStat label="Admins" value={stats.admins} />
        <InfoStat label="Active memberships" value={stats.active} />
        <InfoStat label="With GPS data" value={stats.withGps} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Name, email, employee no., department, GPS..."
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
              <option value="apprentice">Apprentice</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading employees...</div>
        ) : pageError ? (
          <div className="p-8">
            <h3 className="text-lg font-semibold text-slate-900">
              Employees could not be loaded
            </h3>
            <p className="mt-2 text-sm text-red-600">{pageError}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">
                No employees match the current filters.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Person</th>
                    <th className="px-4 py-3">Employee no.</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Job title</th>
                    <th className="px-4 py-3">Contract</th>
                    <th className="px-4 py-3">Weekly target</th>
                    <th className="px-4 py-3">Monthly target</th>
                    {canSeeGps ? <th className="px-4 py-3">Latest GPS</th> : null}
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          {formatPersonName(item)}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {item.user?.email || "-"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.user?.public_id || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.employee_number || "-"}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        <Pill>{item.role}</Pill>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.department || "-"}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.job_title || "-"}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.contract_type || "-"}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.weekly_target_hours ?? "-"}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.monthly_target_hours ?? "-"}
                      </td>

                      {canSeeGps ? (
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {gpsLoading && !gpsByMembershipId[item.id] ? (
                            <div className="text-xs text-slate-400">
                              Loading GPS...
                            </div>
                          ) : (
                            <GpsCell gps={gpsByMembershipId[item.id]} />
                          )}
                        </td>
                      ) : null}

                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <Pill tone={item.is_active ? "success" : "warning"}>
                            {item.is_active ? "active" : "inactive"}
                          </Pill>

                          {item.employment_status ? (
                            <Pill>{item.employment_status}</Pill>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-4">
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

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