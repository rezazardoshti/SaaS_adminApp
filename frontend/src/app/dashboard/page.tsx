"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

function AdminCard({
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

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    company,
    membership,
    isLoading,
    isAuthenticated,
    canAccessAdminDashboard,
  } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!canAccessAdminDashboard) {
      router.replace("/workspace");
    }
  }, [isLoading, isAuthenticated, canAccessAdminDashboard, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-10 sm:px-8 lg:px-10">
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
            Loading dashboard...
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !canAccessAdminDashboard) {
    return null;
  }

  const displayName =
    user?.full_name?.trim() ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.email ||
    "User";

  const roleLabel = user?.is_superuser
    ? "Superuser"
    : membership?.role
    ? membership.role.charAt(0).toUpperCase() + membership.role.slice(1)
    : "Admin";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                Company dashboard
              </p>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Welcome, {displayName}
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                Manage your company operations, employees, approvals, and daily
                workflows from one central dashboard.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/workspace"
                className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Open my workspace
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Company</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {company?.company_name || "-"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Current active company context.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Role</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {roleLabel}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Access level inside this company.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Department</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {membership?.department || "-"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Loaded from your active membership.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Job title</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {membership?.job_title || "-"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Your internal company position.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AdminCard
            title="Employees"
            description="Add, edit, review, and manage employee records and company members."
            href="/dashboard/employees"
            actionLabel="Open employees"
          />

          <AdminCard
            title="Worktime overview"
            description="Review team attendance, check working time records, and supervise daily activity."
            href="/dashboard/worktime"
            actionLabel="Open worktime"
          />

          <AdminCard
            title="Vacation approvals"
            description="Review leave requests, approve or reject vacations, and manage absence planning."
            href="/dashboard/vacations"
            actionLabel="Open vacations"
          />

          <AdminCard
            title="Documents"
            description="Review incoming employee documents and manage document-related workflows."
            href="/dashboard/documents"
            actionLabel="Open documents"
          />

          <AdminCard
            title="Messages"
            description="Send announcements, updates, and internal communication to your team."
            href="/dashboard/messages"
            actionLabel="Open messages"
          />

          <AdminCard
            title="Schedule planning"
            description="Create and manage work schedules, shifts, and planning information for employees."
            href="/dashboard/schedule"
            actionLabel="Open schedule"
          />
        </div>
      </section>
    </main>
  );
}