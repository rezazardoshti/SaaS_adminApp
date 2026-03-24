"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useAuth } from "@/context/AuthContext";

function InfoCard({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>

      <div className="mt-6">
        <Link
          href={href}
          className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 break-words">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </div>
  );
}

export default function WorkspacePage() {
  const { user, membership, company, canAccessAdminDashboard } = useAuth();

  const displayName = useMemo(() => {
    return (
      user?.full_name?.trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      user?.email ||
      "User"
    );
  }, [user]);

  const roleLabel = useMemo(() => {
    if (user?.is_superuser) return "Superuser";

    const role = membership?.role || user?.role;

    if (!role) return "Member";

    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [membership, user]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
              Employee workspace
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back, {displayName}
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              This is your daily work area for time tracking, leave requests,
              documents, messages, and schedules.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-500">Signed in as</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {roleLabel}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {company?.company_name || "No company assigned"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickStat
          label="Company"
          value={company?.company_name || "-"}
          helper="Your active company workspace."
        />
        <QuickStat
          label="Role"
          value={roleLabel}
          helper="Permissions are based on your company role."
        />
        <QuickStat
          label="Department"
          value={membership?.department || "-"}
          helper="Shown from your current membership."
        />
        <QuickStat
          label="Job title"
          value={membership?.job_title || "-"}
          helper="Your current role inside the company."
        />
      </section>

      {canAccessAdminDashboard ? (
        <section className="rounded-3xl border border-sky-200 bg-sky-50 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
                Admin access
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                You also have access to company management.
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Use your personal workspace for daily tasks, or move to the
                admin dashboard to manage employees, company operations, and
                team workflows.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open admin dashboard
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <InfoCard
          title="Working time"
          description="Start and end your workday, review attendance, and manage your daily worktime actions."
          href="/workspace/worktime"
          actionLabel="Open working time"
        />

        <InfoCard
          title="Vacation"
          description="Create leave requests, review request status, and keep your absences organized in one place."
          href="/workspace/vacations"
          actionLabel="Open vacation"
        />

        <InfoCard
          title="Documents"
          description="Send files and personnel-related documents to your admin or company management."
          href="/workspace/documents"
          actionLabel="Open documents"
        />

        <InfoCard
          title="Messages"
          description="Read company messages, updates, and important communication shared by your admin."
          href="/workspace/messages"
          actionLabel="Open messages"
        />

        <InfoCard
          title="Work schedule"
          description="View assigned schedules, shifts, and upcoming planning information from your company."
          href="/workspace/schedule"
          actionLabel="Open schedule"
        />

        <InfoCard
          title="Profile"
          description="Review your current account and membership information inside the company workspace."
          href="/workspace/profile"
          actionLabel="Open profile"
        />
      </section>

      <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Recommended next step
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          The workspace area is now connected to the shared protected layout.
          Next, we should create the first real employee tool page, starting
          with working time.
        </p>
      </section>
    </div>
  );
}