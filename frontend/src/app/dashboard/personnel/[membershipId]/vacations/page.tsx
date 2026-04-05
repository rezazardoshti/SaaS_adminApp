"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { getMyMemberships } from "@/services/api/employees";
import {
  formatVacationDate,
  getVacationBalances,
  getVacationLeaveTypeLabel,
  getVacationRequests,
  getVacationStatusLabel,
  toNumber,
  type VacationBalanceItem,
  type VacationRequestItem,
} from "@/services/api/vacations";

type ActiveMembership = {
  id: number;
  company: number;
  role: "owner" | "admin" | "employee";
  is_active?: boolean;
};

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function getStatusTone(status?: string | null) {
  switch (status) {
    case "approved":
      return "success" as const;
    case "pending":
      return "warning" as const;
    case "rejected":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function formatDays(value: string | number | null | undefined) {
  return toNumber(value).toFixed(2);
}

export default function EmployeeVacationsPage() {
  const { access } = useAuth();
  const params = useParams();

  const membershipIdParam = Array.isArray(params?.membershipId)
    ? params.membershipId[0]
    : params?.membershipId;

  const employeeMembershipId = Number(membershipIdParam);

  const [requests, setRequests] = useState<VacationRequestItem[]>([]);
  const [balances, setBalances] = useState<VacationBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const loadData = useCallback(async () => {
    if (!access) return;

    if (!Number.isFinite(employeeMembershipId)) {
      setPageError("Invalid employee membership ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const memberships = (await getMyMemberships(access)) as ActiveMembership[];
      const activeMembership =
        memberships.find((item) => item.is_active) || memberships[0];

      if (!activeMembership?.company) {
        throw { detail: "No active company membership found." };
      }

      const [requestItems, balanceItems] = await Promise.all([
        getVacationRequests({
          company: activeMembership.company,
          employee_membership: employeeMembershipId,
        }),
        getVacationBalances({
          company: activeMembership.company,
          employee_membership: employeeMembershipId,
        }),
      ]);

      setRequests(requestItems);
      setBalances(balanceItems);
    } catch (error: any) {
      setPageError(error?.detail || "Vacation data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [access, employeeMembershipId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestBalance = useMemo(() => {
    if (balances.length === 0) return null;

    return [...balances].sort((a, b) => {
      const yearA = Number(a.year || 0);
      const yearB = Number(b.year || 0);
      return yearB - yearA;
    })[0];
  }, [balances]);

  const stats = useMemo(() => {
    const approved = requests.filter((item) => item.status === "approved").length;
    const pending = requests.filter((item) => item.status === "pending").length;
    const rejected = requests.filter((item) => item.status === "rejected").length;

    return {
      totalRequests: requests.length,
      approved,
      pending,
      rejected,
      entitledDays: latestBalance ? formatDays(latestBalance.entitled_days) : "0.00",
      remainingDays: latestBalance ? formatDays(latestBalance.remaining_days) : "0.00",
      usedDays: latestBalance ? formatDays(latestBalance.used_days) : "0.00",
      balanceYear: latestBalance?.year ?? "-",
    };
  }, [latestBalance, requests]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Employee vacations
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Vacation overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Here you can review vacation balances and all vacation requests for
              the selected employee.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadData();
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Requests"
          value={stats.totalRequests}
          helper="All vacation requests"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          helper="Waiting for approval"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          helper="Approved requests"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          helper="Rejected requests"
        />
        <StatCard
          label="Entitled days"
          value={stats.entitledDays}
          helper={`Balance year ${stats.balanceYear}`}
        />
        <StatCard
          label="Remaining days"
          value={stats.remainingDays}
          helper={`Used: ${stats.usedDays}`}
        />
      </section>

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading vacation data...</p>
        </section>
      ) : pageError ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-800">
            Vacation data could not be loaded
          </h2>
          <p className="mt-2 text-sm text-red-700">{pageError}</p>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Vacation balances
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Annual balance data for this employee.
                </p>
              </div>
            </div>

            {balances.length === 0 ? (
              <p className="text-sm text-slate-500">
                No vacation balance is available for this employee.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Year</th>
                      <th className="px-4 py-3 font-medium">Entitled</th>
                      <th className="px-4 py-3 font-medium">Carried over</th>
                      <th className="px-4 py-3 font-medium">Adjustment</th>
                      <th className="px-4 py-3 font-medium">Available</th>
                      <th className="px-4 py-3 font-medium">Used</th>
                      <th className="px-4 py-3 font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances
                      .slice()
                      .sort((a, b) => Number(b.year) - Number(a.year))
                      .map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-4 py-3">{item.year}</td>
                          <td className="px-4 py-3">
                            {formatDays(item.entitled_days)}
                          </td>
                          <td className="px-4 py-3">
                            {formatDays(item.carried_over_days)}
                          </td>
                          <td className="px-4 py-3">
                            {formatDays(item.manual_adjustment_days)}
                          </td>
                          <td className="px-4 py-3">
                            {formatDays(item.total_available_days)}
                          </td>
                          <td className="px-4 py-3">
                            {formatDays(item.used_days)}
                          </td>
                          <td className="px-4 py-3">
                            {formatDays(item.remaining_days)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Vacation requests
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  All vacation requests that belong to this employee.
                </p>
              </div>
            </div>

            {requests.length === 0 ? (
              <p className="text-sm text-slate-500">
                No vacation requests are available for this employee.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Public ID</th>
                      <th className="px-4 py-3 font-medium">Leave type</th>
                      <th className="px-4 py-3 font-medium">From</th>
                      <th className="px-4 py-3 font-medium">To</th>
                      <th className="px-4 py-3 font-medium">Days</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100 align-top"
                      >
                        <td className="px-4 py-3">{item.public_id || "-"}</td>
                        <td className="px-4 py-3">
                          {getVacationLeaveTypeLabel(item.leave_type)}
                        </td>
                        <td className="px-4 py-3">
                          {formatVacationDate(item.start_date)}
                        </td>
                        <td className="px-4 py-3">
                          {formatVacationDate(item.end_date)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDays(item.requested_days)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={getStatusTone(item.status)}>
                            {getVacationStatusLabel(item.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {formatVacationDate(item.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}