"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getDashboardData,
  type DashboardPayload,
} from "@/services/api/dashboard";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function AlertBadge({
  tone,
  value,
}: {
  tone: "neutral" | "warning" | "success";
  value: string;
}) {
  const classes =
    tone === "warning"
      ? "bg-amber-100 text-amber-800"
      : tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {value}
    </span>
  );
}

const emptyDashboard: DashboardPayload = {
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
  alerts: [],
  activities: [],
};

export default function DashboardPage() {
  const { user, access } = useAuth();

  const [dashboard, setDashboard] = useState<DashboardPayload>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      if (!access) return;

      setLoading(true);
      setLoadError(null);

      try {
        const data = await getDashboardData(access);
        setDashboard(data);
      } catch (error: any) {
        const message =
          error?.detail || "Dashboard data could not be loaded from backend.";
        setLoadError(String(message));
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [access]);

  const displayName = useMemo(() => {
    return (
      user?.full_name?.trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      user?.email ||
      "User"
    );
  }, [user]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">
          Welcome back,{" "}
          <span className="font-semibold text-slate-900">{displayName}</span>
        </p>
        <p className="mt-2 text-sm text-slate-500">
          This overview is limited to the currently signed-in company account.
        </p>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">Loading dashboard data...</p>
        </section>
      ) : loadError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-800">
            Dashboard could not be loaded
          </h2>
          <p className="mt-2 text-sm text-red-700">{loadError}</p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active employees"
              value={dashboard.stats.activeEmployees}
              helper="Only inside the current company"
            />
            <StatCard
              label="Pending vacations"
              value={dashboard.stats.pendingVacations}
              helper="Requests that still need attention"
            />
            <StatCard
              label="Open invoices"
              value={dashboard.stats.openInvoices}
              helper="Currently visible in this workspace"
            />
            <StatCard
              label="Active projects"
              value={dashboard.stats.activeProjects}
              helper="Operational overview"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard title="Company overview">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Company name</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {dashboard.company?.company_name ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Industry</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {dashboard.company?.industry || "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Subscription</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {dashboard.company?.subscription_plan || "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Company status</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {dashboard.company?.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Role and scope">
              <div className="space-y-3 text-sm text-slate-600">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">Signed-in role</p>
                  <p className="mt-2 font-semibold capitalize text-slate-900">
                    {dashboard.membership?.role ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">Department</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {dashboard.membership?.department || "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">Job title</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {dashboard.membership?.job_title || "-"}
                  </p>
                </div>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <SectionCard title="Personnel">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <span className="text-sm text-slate-600">Owners</span>
                  <strong className="text-slate-900">
                    {dashboard.stats.owners}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <span className="text-sm text-slate-600">Admins</span>
                  <strong className="text-slate-900">
                    {dashboard.stats.admins}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <span className="text-sm text-slate-600">Employees</span>
                  <strong className="text-slate-900">
                    {dashboard.stats.activeEmployees}
                  </strong>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Operations">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <span className="text-sm text-slate-600">Worktime entries</span>
                  <strong className="text-slate-900">
                    {dashboard.stats.worktimeEntries}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <span className="text-sm text-slate-600">Projects</span>
                  <strong className="text-slate-900">
                    {dashboard.stats.activeProjects}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <span className="text-sm text-slate-600">Documents</span>
                  <strong className="text-slate-900">
                    {dashboard.stats.documentCount}
                  </strong>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Approvals and finance">
              <div className="space-y-3">
                {dashboard.alerts.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                  >
                    <span className="text-sm text-slate-700">{item.title}</span>
                    <AlertBadge tone={item.tone} value={item.value} />
                  </div>
                ))}
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard title="What this dashboard covers">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">Personnel</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Employees, memberships, roles, and personnel-related
                    structure.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">
                    Worktime & vacations
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Time tracking, attendance, absences, requests, and approvals
                    inside personnel.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">Documents</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Personnel-related records and files organized within the
                    company workspace.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">
                    Projects & invoices
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Operational workload and financial follow-up.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Recent dashboard signals">
              <div className="space-y-3">
                {dashboard.activities.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    No activity signals could be generated yet.
                  </div>
                ) : (
                  dashboard.activities.map((item) => (
                    <div key={item.id} className="rounded-xl bg-slate-50 p-4">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </section>
        </>
      )}
    </div>
  );
}