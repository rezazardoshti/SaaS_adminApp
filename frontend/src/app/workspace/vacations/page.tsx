"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMyMemberships } from "@/services/api/employees";
import {
  approveVacationRequest,
  cancelVacationRequest,
  createVacationRequest,
  formatVacationDate,
  getVacationBalances,
  getVacationLeaveTypeLabel,
  getVacationRequests,
  getVacationStatusLabel,
  getYearOptions,
  rejectVacationRequest,
  sortVacationRequestsByDate,
  submitVacationRequest,
  toNumber,
  updateVacationRequest,
  type VacationBalanceItem,
  type VacationLeaveType,
  type VacationRequestItem,
  type VacationStatus,
} from "@/services/api/vacations";

type MembershipWithVacation = {
  id: number;
  role: "owner" | "admin" | "employee";
  company: number;
  company_public_id?: string;
  company_name?: string;
  employee_number?: string | null;
  department?: string | null;
  monthly_target_hours?: string | number | null;
  vacation_days_per_year?: string | number | null;
  is_active: boolean;
};

type VacationFormState = {
  leave_type: VacationLeaveType;
  start_date: string;
  end_date: string;
  is_half_day_start: boolean;
  is_half_day_end: boolean;
  reason: string;
  employee_note: string;
};

type DecisionState = {
  requestId: number | null;
  action: "approve" | "reject" | null;
  manager_note: string;
};

const INITIAL_FORM: VacationFormState = {
  leave_type: "annual",
  start_date: "",
  end_date: "",
  is_half_day_start: false,
  is_half_day_end: false,
  reason: "",
  employee_note: "",
};

function StatCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{helper}</div>
    </div>
  );
}

function MessageBox({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {text}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function getSafeAccessToken(access?: string | null) {
  if (access && access.trim()) return access;

  if (typeof window !== "undefined") {
    const fallback =
      localStorage.getItem("access") ||
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("access") ||
      sessionStorage.getItem("accessToken");

    if (fallback && fallback.trim()) return fallback;
  }

  return "";
}

function parseApiError(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;

    if (typeof maybeError.detail === "string") return maybeError.detail;
    if (typeof maybeError.message === "string") return maybeError.message;

    for (const value of Object.values(maybeError)) {
      if (typeof value === "string" && value.trim()) return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function formatDateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function calculateRequestedDaysPreview(
  startDate: string,
  endDate: string,
  isHalfDayStart: boolean,
  isHalfDayEnd: boolean
) {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  let total = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  if (total === 0) return 0;

  if (startDate === endDate) {
    const sameDay = start.getDay();
    if (sameDay === 0 || sameDay === 6) return 0;
    if (isHalfDayStart || isHalfDayEnd) return 0.5;
    return 1;
  }

  if (isHalfDayStart) {
    const startDay = start.getDay();
    if (startDay !== 0 && startDay !== 6) total -= 0.5;
  }

  if (isHalfDayEnd) {
    const endDay = end.getDay();
    if (endDay !== 0 && endDay !== 6) total -= 0.5;
  }

  return Math.max(0, total);
}

function isEditableByEmployee(status?: VacationStatus | string | null) {
  return status === "draft" || status === "pending" ;
}

function isCancelableByEmployee(status?: VacationStatus | string | null) {
  return status === "draft" || status === "pending" ;
}

function shouldAutoSubmit(status?: VacationStatus | string | null) {
  return status === "draft" || status === "rejected";
}

function getStatusBadgeClass(status?: VacationStatus | string | null) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "rejected":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "cancelled":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "draft":
      return "bg-sky-50 text-sky-700 border-sky-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function WorkspaceVacationsPage() {
  const { user, membership, company, access: authAccess } = useAuth();
  const access = getSafeAccessToken(authAccess);
  const membershipFromContext = membership as MembershipWithVacation | null;

  const now = new Date();
  const initialYear = now.getFullYear();

  const [resolvedMembership, setResolvedMembership] = useState<MembershipWithVacation | null>(
    membershipFromContext
  );
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  const [balances, setBalances] = useState<VacationBalanceItem[]>([]);
  const [requests, setRequests] = useState<VacationRequestItem[]>([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState<VacationFormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<"" | VacationStatus>("");
  const [showMineOnly, setShowMineOnly] = useState(true);

  const [decisionState, setDecisionState] = useState<DecisionState>({
    requestId: null,
    action: null,
    manager_note: "",
  });

  const membershipData = resolvedMembership || membershipFromContext;

  const isManager = useMemo(() => {
    const role = membershipData?.role;
    return role === "owner" || role === "admin";
  }, [membershipData]);

  const displayName = useMemo(() => {
    return (
      user?.full_name?.trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      user?.email ||
      "User"
    );
  }, [user]);

  const companyName = company?.company_name || membershipData?.company_name || "-";
  const employeeNumber = membershipData?.employee_number || "-";

  const employeeVacationTarget = useMemo(() => {
    return Math.round(toNumber(membershipData?.vacation_days_per_year || 0));
  }, [membershipData?.vacation_days_per_year]);

  const selectedYearBalance = useMemo(() => {
    if (!balances.length) return null;
    return (
      balances.find((item) => Number(item.year) === Number(selectedYear)) || balances[0] || null
    );
  }, [balances, selectedYear]);

  const approvedAnnualDaysFromRequests = useMemo(() => {
    return requests
      .filter((item) => {
        const startYear = item.start_date ? new Date(item.start_date).getFullYear() : null;
        return (
          startYear === selectedYear &&
          item.status === "approved" &&
          item.leave_type === "annual"
        );
      })
      .reduce((sum, item) => sum + toNumber(item.requested_days || 0), 0);
  }, [requests, selectedYear]);

  const fallbackTotalAvailable = useMemo(() => {
    return employeeVacationTarget;
  }, [employeeVacationTarget]);

  const fallbackUsedDays = useMemo(() => {
    return approvedAnnualDaysFromRequests;
  }, [approvedAnnualDaysFromRequests]);

  const fallbackRemainingDays = useMemo(() => {
    return Math.max(0, fallbackTotalAvailable - fallbackUsedDays);
  }, [fallbackTotalAvailable, fallbackUsedDays]);

  const annualEntitlementDisplay = useMemo(() => {
    if (selectedYearBalance) {
      return String(Math.round(toNumber(selectedYearBalance.remaining_days ?? 0)));
    }
    return String(Math.round(fallbackRemainingDays));
  }, [selectedYearBalance, fallbackRemainingDays]);

  const availableDaysDisplay = useMemo(() => {
    if (selectedYearBalance) {
      return String(Math.round(toNumber(selectedYearBalance.total_available_days ?? 0)));
    }
    return String(Math.round(fallbackTotalAvailable));
  }, [selectedYearBalance, fallbackTotalAvailable]);

  const usedDaysDisplay = useMemo(() => {
    if (selectedYearBalance) {
      return String(Math.round(toNumber(selectedYearBalance.used_days ?? 0)));
    }
    return String(Math.round(fallbackUsedDays));
  }, [selectedYearBalance, fallbackUsedDays]);

  const remainingDaysDisplay = useMemo(() => {
    if (selectedYearBalance) {
      return String(Math.round(toNumber(selectedYearBalance.remaining_days ?? 0)));
    }
    return String(Math.round(fallbackRemainingDays));
  }, [selectedYearBalance, fallbackRemainingDays]);

  const sortedRequests = useMemo(() => {
    const filtered = requests.filter((item) => {
      const startYear = item.start_date ? new Date(item.start_date).getFullYear() : null;
      const yearMatches = startYear === selectedYear;
      const statusMatches = statusFilter ? item.status === statusFilter : true;
      return yearMatches && statusMatches;
    });

    return sortVacationRequestsByDate(filtered);
  }, [requests, selectedYear, statusFilter]);

  const myRequests = useMemo(() => {
    if (!membershipData?.id) return [];
    return sortedRequests.filter(
      (item) => Number(item.employee_membership) === Number(membershipData.id)
    );
  }, [sortedRequests, membershipData?.id]);

  const visibleRequests = useMemo(() => {
    if (!isManager || showMineOnly) return myRequests;
    return sortedRequests;
  }, [isManager, myRequests, showMineOnly, sortedRequests]);

  const requestPreviewDays = useMemo(() => {
    return calculateRequestedDaysPreview(
      form.start_date,
      form.end_date,
      form.is_half_day_start,
      form.is_half_day_end
    );
  }, [form]);

  const yearOptions = useMemo(() => getYearOptions(initialYear, 3), [initialYear]);

  const loadVacationData = useCallback(
    async (showLoader = true) => {
      if (!access) {
        setPageLoading(false);
        return;
      }

      try {
        if (showLoader) setPageLoading(true);
        setErrorMessage("");

        let activeMembership = membershipData;

        if (!activeMembership?.company || !activeMembership?.id) {
          const memberships = (await getMyMemberships(access)) as MembershipWithVacation[];
          activeMembership = memberships.find((item) => item.is_active) || memberships[0] || null;
          setResolvedMembership(activeMembership);
        }

        if (!activeMembership?.company || !activeMembership?.id) {
          throw new Error("Company or employee membership is missing for this account.");
        }

        const companyId = activeMembership.company;
        const requestParams =
          isManager && !showMineOnly
            ? {
                company: companyId,
                status: statusFilter || undefined,
                start_date: `${selectedYear}-01-01`,
                end_date: `${selectedYear}-12-31`,
              }
            : {
                mine: true,
                company: companyId,
                status: statusFilter || undefined,
                start_date: `${selectedYear}-01-01`,
                end_date: `${selectedYear}-12-31`,
              };

        const [requestData, balanceData] = await Promise.all([
          getVacationRequests(requestParams),
          getVacationBalances(
            isManager && !showMineOnly
              ? { company: companyId, year: selectedYear }
              : { mine: true, company: companyId, year: selectedYear }
          ),
        ]);

        setRequests(Array.isArray(requestData) ? requestData : []);
        setBalances(Array.isArray(balanceData) ? balanceData : []);
      } catch (error) {
        setErrorMessage(parseApiError(error, "Vacation data could not be loaded."));
      } finally {
        if (showLoader) setPageLoading(false);
      }
    },
    [access, isManager, membershipData, selectedYear, showMineOnly, statusFilter]
  );

  useEffect(() => {
    loadVacationData(true);
  }, [loadVacationData]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (successMessage || errorMessage) {
      timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 6000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [successMessage, errorMessage]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingId(null);
  }

  function fillFormFromRequest(item: VacationRequestItem) {
    setEditingId(item.id);
    setForm({
      leave_type: item.leave_type || "annual",
      start_date: formatDateInputValue(item.start_date),
      end_date: formatDateInputValue(item.end_date),
      is_half_day_start: Boolean(item.is_half_day_start),
      is_half_day_end: Boolean(item.is_half_day_end),
      reason: item.reason || "",
      employee_note: item.employee_note || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAndAutoSubmit(payload: {
    company: number;
    employee_membership: number;
    leave_type: VacationLeaveType;
    start_date: string;
    end_date: string;
    is_half_day_start: boolean;
    is_half_day_end: boolean;
    reason: string;
    employee_note: string;
  }) {
    let savedItem: VacationRequestItem;

    if (editingId) {
      savedItem = await updateVacationRequest(editingId, payload);
    } else {
      savedItem = await createVacationRequest(payload);
    }

    if (shouldAutoSubmit(savedItem.status)) {
      savedItem = await submitVacationRequest(savedItem.id, {
        employee_note: payload.employee_note,
      });
    }

    return savedItem;
  }

  async function handleSaveRequest(e: React.FormEvent) {
    e.preventDefault();

    if (!access) {
      setErrorMessage("Authentication is missing. Please sign in again.");
      return;
    }

    if (!membershipData?.company || !membershipData?.id) {
      setErrorMessage("Company or employee membership is missing for this account.");
      return;
    }

    if (!form.start_date || !form.end_date) {
      setErrorMessage("Please select both start date and end date.");
      return;
    }

    if (form.end_date < form.start_date) {
      setErrorMessage("End date must be on or after start date.");
      return;
    }

    try {
      setActionLoading(editingId ? "update" : "create");
      setErrorMessage("");
      setSuccessMessage("");

      const payload = {
        company: membershipData.company,
        employee_membership: membershipData.id,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        is_half_day_start: form.is_half_day_start,
        is_half_day_end: form.is_half_day_end,
        reason: form.reason.trim(),
        employee_note: form.employee_note.trim(),
      };

      await saveAndAutoSubmit(payload);

      setSuccessMessage(
        editingId
          ? "Vacation request updated and sent for review."
          : "Vacation request created and sent for review."
      );

      resetForm();
      await loadVacationData(false);
    } catch (error) {
      setErrorMessage(parseApiError(error, "Vacation request could not be saved."));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelRequest(item: VacationRequestItem) {
    try {
      setActionLoading(`cancel-${item.id}`);
      setErrorMessage("");
      setSuccessMessage("");

      await cancelVacationRequest(item.id, {
        employee_note: item.employee_note || "",
      });

      setSuccessMessage("Vacation request cancelled successfully.");
      await loadVacationData(false);
    } catch (error) {
      setErrorMessage(parseApiError(error, "Vacation request could not be cancelled."));
    } finally {
      setActionLoading(null);
    }
  }

  function openDecision(item: VacationRequestItem, action: "approve" | "reject") {
    setDecisionState({
      requestId: item.id,
      action,
      manager_note: item.manager_note || "",
    });
  }

  function closeDecision() {
    setDecisionState({
      requestId: null,
      action: null,
      manager_note: "",
    });
  }

  async function handleDecisionSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!decisionState.requestId || !decisionState.action) return;

    try {
      setActionLoading(`${decisionState.action}-${decisionState.requestId}`);
      setErrorMessage("");
      setSuccessMessage("");

      if (decisionState.action === "approve") {
        await approveVacationRequest(decisionState.requestId, {
          manager_note: decisionState.manager_note.trim(),
        });
        setSuccessMessage("Vacation request approved successfully.");
      } else {
        await rejectVacationRequest(decisionState.requestId, {
          manager_note: decisionState.manager_note.trim(),
        });
        setSuccessMessage("Vacation request rejected successfully.");
      }

      closeDecision();
      await loadVacationData(false);
    } catch (error) {
      setErrorMessage(parseApiError(error, "Decision could not be saved."));
    } finally {
      setActionLoading(null);
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Loading vacation workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-3xl bg-slate-900 px-6 py-7 text-white shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-slate-300">Vacation workspace</div>
              <h1 className="mt-2 text-3xl font-semibold">{displayName}</h1>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
                <span>Company: {companyName}</span>
                <span>Employee No: {employeeNumber}</span>
                <span>Role: {membershipData?.role || "-"}</span>
              </div>
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
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {isManager ? (
                <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={showMineOnly}
                    onChange={(e) => setShowMineOnly(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Show only my requests
                </label>
              ) : null}
            </div>
          </div>
        </div>

        {successMessage ? <MessageBox type="success" text={successMessage} /> : null}
        {errorMessage ? <MessageBox type="error" text={errorMessage} /> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Annual entitlement"
            value={annualEntitlementDisplay}
            helper="Still available after approved leave"
          />
          <StatCard
            title="Total available"
            value={availableDaysDisplay}
            helper={`For ${selectedYear}`}
          />
          <StatCard
            title="Used days"
            value={usedDaysDisplay}
            helper="Approved leave only"
          />
          <StatCard
            title="Remaining days"
            value={remainingDaysDisplay}
            helper="Still available to request"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
          <SectionCard
            title={editingId ? "Edit vacation request" : "Create vacation request"}
            subtitle="Choose your vacation period. Saving sends it directly for review."
          >
            <form onSubmit={handleSaveRequest} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Leave type
                  </label>
                  <select
                    value={form.leave_type}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        leave_type: e.target.value as VacationLeaveType,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                  >
                    <option value="annual">Annual Leave</option>
                    <option value="special">Special Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    End date
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_half_day_start}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_half_day_start: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                  Half day at start
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_half_day_end}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_half_day_end: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                  Half day at end
                </label>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Estimated requested days:{" "}
                <span className="font-semibold">{requestPreviewDays}</span>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Reason</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Example: family trip, school holiday, personal reason"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Note</label>
                <textarea
                  value={form.employee_note}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      employee_note: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Optional message for management"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={actionLoading === "create" || actionLoading === "update"}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading === "create" || actionLoading === "update"
                    ? "Saving..."
                    : editingId
                    ? "Update and send"
                    : "Save and send"}
                </button>

                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel editing
                  </button>
                ) : null}
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Vacation requests"
            subtitle={
              isManager && !showMineOnly
                ? "All visible company vacation requests"
                : "Your vacation requests for the selected year"
            }
          >
            {visibleRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                No vacation requests found for the selected filters.
              </div>
            ) : (
              <div className="grid gap-4">
                {visibleRequests.map((item) => {
                  const isOwnRequest =
                    Number(item.employee_membership) === Number(membershipData?.id);

                  const canEdit = isOwnRequest && isEditableByEmployee(item.status);
                  const canCancel = isOwnRequest && isCancelableByEmployee(item.status);
                  const canDecide =
                    isManager &&
                    item.status === "pending" &&
                    Number(item.employee_membership) !== Number(membershipData?.id);

                  return (
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
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                                item.status
                              )}`}
                            >
                              {getVacationStatusLabel(item.status)}
                            </span>
                          </div>

                          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                            <div>
                              <span className="font-medium text-slate-800">Employee:</span>{" "}
                              {item.employee_name || displayName}
                            </div>
                            <div>
                              <span className="font-medium text-slate-800">Type:</span>{" "}
                              {getVacationLeaveTypeLabel(item.leave_type)}
                            </div>
                            <div>
                              <span className="font-medium text-slate-800">Days:</span>{" "}
                              {Math.round(toNumber(item.requested_days || 0))}
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
                              <span className="font-medium text-slate-800">Employee No:</span>{" "}
                              {item.employee_number || "-"}
                            </div>
                          </div>

                          {item.reason ? (
                            <div className="text-sm text-slate-700">
                              <span className="font-medium text-slate-800">Reason:</span>{" "}
                              {item.reason}
                            </div>
                          ) : null}

                          {(item.is_half_day_start || item.is_half_day_end) ? (
                            <div className="text-sm text-slate-700">
                              <span className="font-medium text-slate-800">Half day:</span>{" "}
                              {[
                                item.is_half_day_start ? "Start" : null,
                                item.is_half_day_end ? "End" : null,
                              ]
                                .filter(Boolean)
                                .join(" / ")}
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

                        <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => fillFormFromRequest(item)}
                              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          ) : null}

                          {canCancel ? (
                            <button
                              type="button"
                              onClick={() => handleCancelRequest(item)}
                              disabled={actionLoading === `cancel-${item.id}`}
                              className="rounded-2xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {actionLoading === `cancel-${item.id}` ? "Cancelling..." : "Cancel"}
                            </button>
                          ) : null}

                          {canDecide ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openDecision(item, "approve")}
                                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                onClick={() => openDecision(item, "reject")}
                                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Vacation balance"
          subtitle={`Overview for ${selectedYear}`}
          right={
            <div className="text-sm text-slate-500">
              Membership target: <span className="font-semibold">{employeeVacationTarget}</span>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-slate-500">
                  <th className="px-4 py-2 font-medium">Year</th>
                  <th className="px-4 py-2 font-medium">Entitlement</th>
                  <th className="px-4 py-2 font-medium">Carry over</th>
                  <th className="px-4 py-2 font-medium">Adjustment</th>
                  <th className="px-4 py-2 font-medium">Available</th>
                  <th className="px-4 py-2 font-medium">Used</th>
                  <th className="px-4 py-2 font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No balance data found.
                    </td>
                  </tr>
                ) : (
                  balances.map((item) => (
                    <tr key={item.id} className="rounded-2xl bg-slate-50 text-sm text-slate-700">
                      <td className="rounded-l-2xl px-4 py-3 font-semibold text-slate-900">
                        {item.year}
                      </td>
                      <td className="px-4 py-3">
                        {Math.round(toNumber(item.base_entitlement_days ?? item.entitled_days ?? 0))}
                      </td>
                      <td className="px-4 py-3">
                        {Math.round(toNumber(item.carried_over_days ?? 0))}
                      </td>
                      <td className="px-4 py-3">
                        {Math.round(toNumber(item.manual_adjustment_days ?? 0))}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {Math.round(toNumber(item.total_available_days ?? 0))}
                      </td>
                      <td className="px-4 py-3">{Math.round(toNumber(item.used_days ?? 0))}</td>
                      <td className="rounded-r-2xl px-4 py-3 font-semibold text-emerald-700">
                        {Math.round(toNumber(item.remaining_days ?? 0))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {decisionState.requestId && decisionState.action ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-semibold text-slate-900">
                {decisionState.action === "approve" ? "Approve request" : "Reject request"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Add an optional note for the employee.
              </p>

              <form onSubmit={handleDecisionSubmit} className="mt-5 grid gap-4">
                <textarea
                  value={decisionState.manager_note}
                  onChange={(e) =>
                    setDecisionState((prev) => ({
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
                    disabled={
                      actionLoading ===
                      `${decisionState.action}-${decisionState.requestId}`
                    }
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      decisionState.action === "approve"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    {actionLoading === `${decisionState.action}-${decisionState.requestId}`
                      ? "Saving..."
                      : decisionState.action === "approve"
                      ? "Approve now"
                      : "Reject now"}
                  </button>

                  <button
                    type="button"
                    onClick={closeDecision}
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}