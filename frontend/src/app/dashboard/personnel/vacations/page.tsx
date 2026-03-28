"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PersonnelSubnav from "@/components/dashboard/PersonnelSubnav";
import { useAuth } from "@/context/AuthContext";
import {
  getEmployees,
  getMyMemberships,
  type EmployeeMembershipItem,
} from "@/services/api/employees";
import {
  approveVacationRequest,
  formatVacationDate,
  getVacationBalances,
  getVacationLeaveTypeLabel,
  getVacationRequests,
  getVacationStatusLabel,
  getYearOptions,
  rejectVacationRequest,
  toNumber,
  type VacationBalanceItem,
  type VacationRequestItem,
  type VacationStatus,
} from "@/services/api/vacations";

type FlashMessage = {
  type: "success" | "error";
  text: string;
} | null;

type DecisionModalState = {
  open: boolean;
  action: "approve" | "reject" | null;
  request: VacationRequestItem | null;
  manager_note: string;
};

type BalanceModalState = {
  open: boolean;
  mode: "create" | "edit";
  item: VacationBalanceItem | null;
  employee_membership: string;
  year: string;
  entitled_days: string;
  carried_over_days: string;
  manual_adjustment_days: string;
  note: string;
};

type ActiveMembership = {
  id: number;
  company: number;
  role: "owner" | "admin" | "employee";
  company_name?: string;
  is_active?: boolean;
};

type EnrichedBalanceRow = {
  key: string;
  id: number | null;
  company: number | null;
  employee_membership: number;
  employee_name: string;
  employee_number: string;
  year: number;
  entitled_days: number;
  carried_over_days: number;
  manual_adjustment_days: number;
  total_available_days: number;
  used_days: number;
  remaining_days: number;
  note: string;
  hasBackendBalance: boolean;
  sourceItem: VacationBalanceItem | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getAccessToken(access?: string | null) {
  if (access && access.trim()) return access;

  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("access") ||
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("access") ||
      sessionStorage.getItem("accessToken") ||
      ""
    );
  }

  return "";
}

function buildHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;

  if (error && typeof error === "object") {
    const maybe = error as Record<string, unknown>;

    if (typeof maybe.detail === "string" && maybe.detail.trim()) {
      return maybe.detail;
    }

    if (typeof maybe.message === "string" && maybe.message.trim()) {
      return maybe.message;
    }

    for (const value of Object.values(maybe)) {
      if (typeof value === "string" && value.trim()) return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }

  return fallback;
}

function getStatusTone(status?: string | null) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "cancelled":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "draft":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{helper}</div>
    </div>
  );
}

async function createVacationBalance(
  token: string,
  payload: {
    company: number;
    employee_membership: number;
    year: number;
    entitled_days?: number | null;
    carried_over_days?: number;
    manual_adjustment_days?: number;
    note?: string;
  }
): Promise<VacationBalanceItem> {
  const response = await fetch(`${API_BASE_URL}/vacations/balances/`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Vacation balance could not be created."));
  }

  return data as VacationBalanceItem;
}

async function updateVacationBalance(
  token: string,
  id: number,
  payload: {
    company: number;
    employee_membership: number;
    year: number;
    entitled_days?: number | null;
    carried_over_days?: number;
    manual_adjustment_days?: number;
    note?: string;
  }
): Promise<VacationBalanceItem> {
  const response = await fetch(`${API_BASE_URL}/vacations/balances/${id}/`, {
    method: "PATCH",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Vacation balance could not be updated."));
  }

  return data as VacationBalanceItem;
}

function roundDisplay(value: string | number | null | undefined): string {
  return String(Math.round(toNumber(value)));
}

export default function PersonnelVacationsPage() {
  const { access: authAccess } = useAuth();
  const access = getAccessToken(authAccess);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState<FlashMessage>(null);
  const [pageError, setPageError] = useState("");

  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [employees, setEmployees] = useState<EmployeeMembershipItem[]>([]);
  const [requests, setRequests] = useState<VacationRequestItem[]>([]);
  const [balances, setBalances] = useState<VacationBalanceItem[]>([]);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<"" | VacationStatus>("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [decisionModal, setDecisionModal] = useState<DecisionModalState>({
    open: false,
    action: null,
    request: null,
    manager_note: "",
  });

  const [balanceModal, setBalanceModal] = useState<BalanceModalState>({
    open: false,
    mode: "create",
    item: null,
    employee_membership: "",
    year: String(new Date().getFullYear()),
    entitled_days: "",
    carried_over_days: "0",
    manual_adjustment_days: "0",
    note: "",
  });

  const yearOptions = useMemo(() => getYearOptions(new Date().getFullYear(), 3), []);

  const canManage = useMemo(() => {
    const role = activeMembership?.role;
    return role === "owner" || role === "admin";
  }, [activeMembership]);

  const employeeMap = useMemo(() => {
    const map = new Map<number, EmployeeMembershipItem>();
    employees.forEach((item) => {
      map.set(Number(item.id), item);
    });
    return map;
  }, [employees]);

  const balanceMap = useMemo(() => {
    const map = new Map<number, VacationBalanceItem>();
    balances.forEach((item) => {
      map.set(Number(item.employee_membership), item);
    });
    return map;
  }, [balances]);

  function getEmployeeDisplayNameFromEmployee(employee?: EmployeeMembershipItem | null) {
    if (!employee) return "-";
    return (
      employee.user?.full_name ||
      [employee.user?.first_name, employee.user?.last_name].filter(Boolean).join(" ").trim() ||
      employee.user?.email ||
      "-"
    );
  }

  function getEmployeeDisplayName(request: VacationRequestItem) {
    const employee = employeeMap.get(Number(request.employee_membership));
    return (
      getEmployeeDisplayNameFromEmployee(employee) ||
      (request as { employee_full_name?: string | null }).employee_full_name ||
      request.employee_name ||
      "-"
    );
  }

  function getEmployeeDisplayNumber(request: VacationRequestItem) {
    const employee = employeeMap.get(Number(request.employee_membership));
    return employee?.employee_number || request.employee_number || "-";
  }

  const approvedAnnualUsedByMembership = useMemo(() => {
    const map = new Map<number, number>();

    requests.forEach((item) => {
      const startYear = item.start_date ? new Date(item.start_date).getFullYear() : null;
      if (
        startYear === selectedYear &&
        item.status === "approved" &&
        item.leave_type === "annual"
      ) {
        const membershipId = Number(item.employee_membership);
        const current = map.get(membershipId) ?? 0;
        map.set(membershipId, current + toNumber(item.requested_days));
      }
    });

    return map;
  }, [requests, selectedYear]);

  const enrichedBalanceRows = useMemo<EnrichedBalanceRow[]>(() => {
    return employees.map((employee) => {
      const membershipId = Number(employee.id);
      const existingBalance = balanceMap.get(membershipId) || null;

      const defaultEntitlement =
        existingBalance?.entitled_days !== null && existingBalance?.entitled_days !== undefined
          ? toNumber(existingBalance.entitled_days)
          : toNumber(
              (employee as { vacation_days_per_year?: string | number | null })
                .vacation_days_per_year ?? 0
            );

      const carriedOver = toNumber(existingBalance?.carried_over_days ?? 0);
      const manualAdjustment = toNumber(existingBalance?.manual_adjustment_days ?? 0);

      const fallbackUsed = approvedAnnualUsedByMembership.get(membershipId) ?? 0;

      const totalAvailable = existingBalance
        ? toNumber(existingBalance.total_available_days ?? 0)
        : defaultEntitlement + carriedOver + manualAdjustment;

      const usedDays = existingBalance
        ? toNumber(existingBalance.used_days ?? 0)
        : fallbackUsed;

      const remainingDays = existingBalance
        ? toNumber(existingBalance.remaining_days ?? 0)
        : Math.max(0, totalAvailable - usedDays);

      return {
        key: `${membershipId}-${selectedYear}`,
        id: existingBalance?.id ?? null,
        company: existingBalance?.company
          ? typeof existingBalance.company === "number"
            ? existingBalance.company
            : existingBalance.company?.id ?? activeMembership?.company ?? null
          : activeMembership?.company ?? null,
        employee_membership: membershipId,
        employee_name:
          getEmployeeDisplayNameFromEmployee(employee) ||
          (existingBalance as { employee_full_name?: string | null })?.employee_full_name ||
          "-",
        employee_number: employee.employee_number || "-",
        year: selectedYear,
        entitled_days: defaultEntitlement,
        carried_over_days: carriedOver,
        manual_adjustment_days: manualAdjustment,
        total_available_days: totalAvailable,
        used_days: usedDays,
        remaining_days: remainingDays,
        note: existingBalance?.note || "",
        hasBackendBalance: Boolean(existingBalance),
        sourceItem: existingBalance,
      };
    });
  }, [
    employees,
    balanceMap,
    approvedAnnualUsedByMembership,
    selectedYear,
    activeMembership?.company,
  ]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = normalize(search);

    return requests.filter((item) => {
      const employeeMatches = employeeFilter
        ? String(item.employee_membership) === employeeFilter
        : true;

      const resolvedName = getEmployeeDisplayName(item);
      const resolvedNumber = getEmployeeDisplayNumber(item);

      const searchMatches = !normalizedSearch
        ? true
        : [
            item.public_id,
            resolvedName,
            resolvedNumber,
            item.reason,
            item.employee_note,
            item.manager_note,
          ]
            .map(normalize)
            .some((value) => value.includes(normalizedSearch));

      return employeeMatches && searchMatches;
    });
  }, [employeeFilter, requests, search, employeeMap]);

  const filteredBalanceRows = useMemo(() => {
    const normalizedSearch = normalize(search);

    return enrichedBalanceRows.filter((row) => {
      const employeeMatches = employeeFilter
        ? String(row.employee_membership) === employeeFilter
        : true;

      const searchMatches = !normalizedSearch
        ? true
        : [row.employee_name, row.employee_number, row.note]
            .map(normalize)
            .some((value) => value.includes(normalizedSearch));

      return employeeMatches && searchMatches;
    });
  }, [employeeFilter, enrichedBalanceRows, search]);

  const stats = useMemo(() => {
    const pending = requests.filter((item) => item.status === "pending").length;
    const approved = requests.filter((item) => item.status === "approved").length;
    const rejected = requests.filter((item) => item.status === "rejected").length;
    const totalDays = requests
      .filter((item) => item.status === "approved")
      .reduce((sum, item) => sum + toNumber(item.requested_days), 0);

    return {
      pending,
      approved,
      rejected,
      totalDays: String(Math.round(totalDays)),
    };
  }, [requests]);

  const loadData = useCallback(
    async (withLoader = true) => {
      if (!access) return;

      try {
        if (withLoader) setLoading(true);
        else setRefreshing(true);

        setPageError("");

        const myMemberships = await getMyMemberships(access);
        const currentMembership =
          myMemberships.find((item: ActiveMembership) => item.is_active) || myMemberships[0];

        if (!currentMembership?.company) {
          throw new Error("No active company membership found.");
        }

        setActiveMembership(currentMembership);

        const companyId = currentMembership.company;

        const [employeeItems, requestItems, balanceItems] = await Promise.all([
          getEmployees({
            token: access,
            companyId,
          }),
          getVacationRequests({
            company: companyId,
            status: statusFilter || undefined,
            start_date: `${selectedYear}-01-01`,
            end_date: `${selectedYear}-12-31`,
          }),
          getVacationBalances({
            company: companyId,
            year: selectedYear,
          }),
        ]);

        setEmployees(employeeItems);
        setRequests(Array.isArray(requestItems) ? requestItems : []);
        setBalances(Array.isArray(balanceItems) ? balanceItems : []);
      } catch (error) {
        setPageError(getErrorMessage(error, "Vacation data could not be loaded."));
      } finally {
        if (withLoader) setLoading(false);
        else setRefreshing(false);
      }
    },
    [access, selectedYear, statusFilter]
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function openApproveModal(item: VacationRequestItem) {
    setDecisionModal({
      open: true,
      action: "approve",
      request: item,
      manager_note: item.manager_note || "",
    });
  }

  function openRejectModal(item: VacationRequestItem) {
    setDecisionModal({
      open: true,
      action: "reject",
      request: item,
      manager_note: item.manager_note || "",
    });
  }

  function closeDecisionModal() {
    setDecisionModal({
      open: false,
      action: null,
      request: null,
      manager_note: "",
    });
  }

  async function handleDecisionSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!decisionModal.request || !decisionModal.action) return;

    try {
      if (decisionModal.action === "approve") {
        await approveVacationRequest(decisionModal.request.id, {
          manager_note: decisionModal.manager_note.trim(),
        });
        setFlash({ type: "success", text: "Vacation request approved successfully." });
      } else {
        await rejectVacationRequest(decisionModal.request.id, {
          manager_note: decisionModal.manager_note.trim(),
        });
        setFlash({ type: "success", text: "Vacation request rejected successfully." });
      }

      closeDecisionModal();
      await loadData(false);
    } catch (error) {
      setFlash({
        type: "error",
        text: getErrorMessage(error, "Decision could not be saved."),
      });
    }
  }

  function openCreateBalanceModal() {
    setBalanceModal({
      open: true,
      mode: "create",
      item: null,
      employee_membership: employeeFilter || "",
      year: String(selectedYear),
      entitled_days: "",
      carried_over_days: "0",
      manual_adjustment_days: "0",
      note: "",
    });
  }

  function openEditBalanceModal(row: EnrichedBalanceRow) {
    setBalanceModal({
      open: true,
      mode: row.hasBackendBalance ? "edit" : "create",
      item: row.sourceItem,
      employee_membership: String(row.employee_membership),
      year: String(row.year),
      entitled_days: String(row.entitled_days),
      carried_over_days: String(row.carried_over_days),
      manual_adjustment_days: String(row.manual_adjustment_days),
      note: row.note || "",
    });
  }

  function closeBalanceModal() {
    setBalanceModal((prev) => ({
      ...prev,
      open: false,
      item: null,
    }));
  }

  async function handleBalanceSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!access) {
      setFlash({ type: "error", text: "Authentication is missing." });
      return;
    }

    if (!activeMembership?.company) {
      setFlash({ type: "error", text: "Current company could not be detected." });
      return;
    }

    try {
      const payload = {
        company: activeMembership.company,
        employee_membership: Number(balanceModal.employee_membership),
        year: Number(balanceModal.year),
        entitled_days:
          balanceModal.entitled_days.trim() === ""
            ? null
            : Number(balanceModal.entitled_days),
        carried_over_days: Number(balanceModal.carried_over_days || 0),
        manual_adjustment_days: Number(balanceModal.manual_adjustment_days || 0),
        note: balanceModal.note.trim(),
      };

      if (balanceModal.mode === "create") {
        await createVacationBalance(access, payload);
        setFlash({ type: "success", text: "Vacation balance created successfully." });
      } else if (balanceModal.item?.id) {
        await updateVacationBalance(access, balanceModal.item.id, payload);
        setFlash({ type: "success", text: "Vacation balance updated successfully." });
      }

      closeBalanceModal();
      await loadData(false);
    } catch (error) {
      setFlash({
        type: "error",
        text: getErrorMessage(error, "Vacation balance could not be saved."),
      });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PersonnelSubnav />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Loading personnel vacations...
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PersonnelSubnav />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          You do not have permission to manage company vacations.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PersonnelSubnav />

      {flash ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <section className="rounded-3xl bg-slate-900 px-6 py-7 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-300">Personnel / Vacations</div>
            <h1 className="mt-2 text-3xl font-semibold">Vacation management</h1>
            <p className="mt-2 text-sm text-slate-300">
              Review company vacation requests, approve or reject them, and manage yearly balances.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | VacationStatus)}
              className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="draft">Draft</option>
            </select>

            <button
              type="button"
              onClick={() => loadData(false)}
              className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending requests" value={String(stats.pending)} helper="Need decision" />
        <StatCard label="Approved requests" value={String(stats.approved)} helper="This year" />
        <StatCard label="Rejected requests" value={String(stats.rejected)} helper="This year" />
        <StatCard label="Approved days" value={stats.totalDays} helper="Sum of approved leave" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <p className="mt-1 text-sm text-slate-500">
            Narrow down vacation requests and yearly balances.
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Request ID, employee, reason..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Employee</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            >
              <option value="">All employees</option>
              {employees.map((item) => {
                const name = getEmployeeDisplayNameFromEmployee(item);

                return (
                  <option key={item.id} value={item.id}>
                    {name} {item.employee_number ? `(${item.employee_number})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={openCreateBalanceModal}
              className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Add vacation balance
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Vacation requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review and decide open requests for {selectedYear}.
          </p>
        </div>

        <div className="p-6">
          {pageError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {pageError}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              No vacation requests found for the selected filters.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-base font-semibold text-slate-900">
                          {item.public_id || `Request #${item.id}`}
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(
                            item.status
                          )}`}
                        >
                          {getVacationStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <span className="font-medium text-slate-800">Employee:</span>{" "}
                          {getEmployeeDisplayName(item)}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">Employee No:</span>{" "}
                          {getEmployeeDisplayNumber(item)}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">Type:</span>{" "}
                          {getVacationLeaveTypeLabel(item.leave_type)}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">From:</span>{" "}
                          {formatVacationDate(item.start_date)}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">To:</span>{" "}
                          {formatVacationDate(item.end_date)}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">Days:</span>{" "}
                          {roundDisplay(item.requested_days ?? 0)}
                        </div>
                      </div>

                      {item.reason ? (
                        <div className="text-sm text-slate-700">
                          <span className="font-medium text-slate-800">Reason:</span> {item.reason}
                        </div>
                      ) : null}

                      {item.employee_note ? (
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <span className="font-medium text-slate-800">Employee note:</span>{" "}
                          {item.employee_note}
                        </div>
                      ) : null}

                      {item.manager_note ? (
                        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <span className="font-medium">Management note:</span>{" "}
                          {item.manager_note}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-[280px] lg:justify-end">
                      {item.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openApproveModal(item)}
                            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => openRejectModal(item)}
                            className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500">
                          No action needed
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Vacation balances</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage yearly entitlement, carry-over, manual adjustments, and employee-specific totals.
          </p>
        </div>

        <div className="overflow-x-auto p-6">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-sm text-slate-500">
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Year</th>
                <th className="px-4 py-2 font-medium">Entitlement</th>
                <th className="px-4 py-2 font-medium">Carry over</th>
                <th className="px-4 py-2 font-medium">Adjustment</th>
                <th className="px-4 py-2 font-medium">Available</th>
                <th className="px-4 py-2 font-medium">Used</th>
                <th className="px-4 py-2 font-medium">Remaining</th>
                <th className="px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalanceRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No vacation balances found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredBalanceRows.map((row) => (
                  <tr key={row.key} className="bg-slate-50 text-sm text-slate-700">
                    <td className="rounded-l-2xl px-4 py-3 font-medium text-slate-900">
                      {row.employee_name}
                      <div className="text-xs text-slate-500">{row.employee_number}</div>
                    </td>
                    <td className="px-4 py-3">{row.year}</td>
                    <td className="px-4 py-3">{roundDisplay(row.entitled_days)}</td>
                    <td className="px-4 py-3">{roundDisplay(row.carried_over_days)}</td>
                    <td className="px-4 py-3">{roundDisplay(row.manual_adjustment_days)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {roundDisplay(row.total_available_days)}
                    </td>
                    <td className="px-4 py-3">{roundDisplay(row.used_days)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      {roundDisplay(row.remaining_days)}
                    </td>
                    <td className="rounded-r-2xl px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEditBalanceModal(row)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        {row.hasBackendBalance ? "Edit" : "Create"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {decisionModal.open && decisionModal.request ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">
              {decisionModal.action === "approve"
                ? "Approve vacation request"
                : "Reject vacation request"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Employee: {getEmployeeDisplayName(decisionModal.request)} ·{" "}
              {formatVacationDate(decisionModal.request.start_date)} to{" "}
              {formatVacationDate(decisionModal.request.end_date)}
            </p>

            <form onSubmit={handleDecisionSubmit} className="mt-5 grid gap-4">
              <textarea
                value={decisionModal.manager_note}
                onChange={(e) =>
                  setDecisionModal((prev) => ({
                    ...prev,
                    manager_note: e.target.value,
                  }))
                }
                rows={5}
                placeholder="Optional management note"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white ${
                    decisionModal.action === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {decisionModal.action === "approve" ? "Approve now" : "Reject now"}
                </button>

                <button
                  type="button"
                  onClick={closeDecisionModal}
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {balanceModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">
              {balanceModal.mode === "create" ? "Create vacation balance" : "Edit vacation balance"}
            </h3>

            <form onSubmit={handleBalanceSubmit} className="mt-5 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Employee
                  </label>
                  <select
                    value={balanceModal.employee_membership}
                    onChange={(e) =>
                      setBalanceModal((prev) => ({
                        ...prev,
                        employee_membership: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                    required
                    disabled={balanceModal.mode === "edit"}
                  >
                    <option value="">Select employee</option>
                    {employees.map((item) => {
                      const name = getEmployeeDisplayNameFromEmployee(item);

                      return (
                        <option key={item.id} value={item.id}>
                          {name} {item.employee_number ? `(${item.employee_number})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Year</label>
                  <input
                    type="number"
                    value={balanceModal.year}
                    onChange={(e) =>
                      setBalanceModal((prev) => ({
                        ...prev,
                        year: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                    required
                    disabled={balanceModal.mode === "edit"}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Entitled days
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={balanceModal.entitled_days}
                    onChange={(e) =>
                      setBalanceModal((prev) => ({
                        ...prev,
                        entitled_days: e.target.value,
                      }))
                    }
                    placeholder="Leave empty to use membership value"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Carry-over days
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={balanceModal.carried_over_days}
                    onChange={(e) =>
                      setBalanceModal((prev) => ({
                        ...prev,
                        carried_over_days: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Manual adjustment
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={balanceModal.manual_adjustment_days}
                    onChange={(e) =>
                      setBalanceModal((prev) => ({
                        ...prev,
                        manual_adjustment_days: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Note</label>
                  <textarea
                    rows={4}
                    value={balanceModal.note}
                    onChange={(e) =>
                      setBalanceModal((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                >
                  {balanceModal.mode === "create" ? "Create balance" : "Save changes"}
                </button>

                <button
                  type="button"
                  onClick={closeBalanceModal}
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}