"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { getMyMemberships } from "@/services/api/employees";
import {
  getWorktimeEntries,
  type WorktimeEntry,
} from "@/services/api/worktime";

type MyMembershipItem = {
  id: number;
  company: number;
  company_public_id?: string;
  company_name?: string;
  role: "owner" | "admin" | "employee";
  is_active: boolean;
};

function InfoCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const tone =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "rejected"
      ? "bg-red-100 text-red-700"
      : status === "running"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {status || "-"}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDurationHoursToHHMM(value?: string | number | null) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "00:00";
  }

  const totalMinutes = Math.round(numeric * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export default function EmployeeWorktimePage() {
  const { access } = useAuth();
  const params = useParams();

  const membershipIdParam = Array.isArray(params?.membershipId)
    ? params.membershipId[0]
    : params?.membershipId;

  const employeeMembershipId = Number(membershipIdParam);

  const [entries, setEntries] = useState<WorktimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const loadEntries = useCallback(async () => {
    if (!access) return;

    if (!Number.isFinite(employeeMembershipId)) {
      setPageError("Invalid employee membership ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const myMemberships = (await getMyMemberships(access)) as MyMembershipItem[];
      const activeMembership =
        myMemberships.find((item) => item.is_active) || myMemberships[0];

      if (!activeMembership?.company) {
        throw { detail: "No active company membership found." };
      }

      const entryItems = await getWorktimeEntries({
        token: access,
        companyId: activeMembership.company,
        employeeMembershipId,
      });

      setEntries(entryItems);
    } catch (error: any) {
      setPageError(error?.detail || "Worktime entries could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [access, employeeMembershipId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const stats = useMemo(() => {
    const totalEntries = entries.length;
    const submitted = entries.filter((item) => item.status === "submitted").length;
    const approved = entries.filter((item) => item.status === "approved").length;
    const rejected = entries.filter((item) => item.status === "rejected").length;

    const totalApprovedHours = entries
      .filter((item) => item.status === "approved")
      .reduce((sum, item) => {
        const value = Number(item.duration_hours || 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

    return {
      totalEntries,
      submitted,
      approved,
      rejected,
      totalApprovedHours: formatDurationHoursToHHMM(totalApprovedHours),
    };
  }, [entries]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Employee worktime
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Worktime overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Here you can review all recorded worktime entries for the selected
              employee membership.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadEntries();
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <InfoCard
          label="Entries"
          value={stats.totalEntries}
          helper="All loaded entries"
        />
        <InfoCard
          label="Submitted"
          value={stats.submitted}
          helper="Waiting for review"
        />
        <InfoCard
          label="Approved"
          value={stats.approved}
          helper="Accepted entries"
        />
        <InfoCard
          label="Rejected"
          value={stats.rejected}
          helper="Returned entries"
        />
        <InfoCard
          label="Approved hours"
          value={stats.totalApprovedHours}
          helper="Only approved time"
        />
      </section>

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading worktime entries...</p>
        </section>
      ) : pageError ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-800">
            Worktime entries could not be loaded
          </h2>
          <p className="mt-2 text-sm text-red-700">{pageError}</p>
        </section>
      ) : entries.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            No worktime entries are available for this employee.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Public ID</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium">Break</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.public_id}
                    className="border-t border-slate-100 align-top"
                  >
                    <td className="px-4 py-3">{entry.public_id || "-"}</td>
                    <td className="px-4 py-3">
                      {formatDate(entry.work_date || entry.started_at)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDateTime(entry.started_at)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDateTime(entry.ended_at)}
                    </td>
                    <td className="px-4 py-3">
                      {entry.break_minutes ?? 0} min
                    </td>
                    <td className="px-4 py-3">
                      {formatDurationHoursToHHMM(entry.duration_hours)}
                    </td>
                    <td className="px-4 py-3">{entry.project_name || "-"}</td>
                    <td className="px-4 py-3">{entry.entry_type || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}