"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

const workspaceLinks = [
  { href: "/workspace", label: "Overview" },
  { href: "/workspace/worktime", label: "Working time" },
  { href: "/workspace/vacations", label: "Vacation" },
  { href: "/workspace/documents", label: "Documents" },
  { href: "/workspace/messages", label: "Messages" },
  { href: "/workspace/schedule", label: "Work schedule" },
  { href: "/workspace/profile", label: "Profile" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/workspace") {
    return pathname === "/workspace";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    user,
    company,
    membership,
    isLoading,
    isAuthenticated,
    canAccessAdminDashboard,
    canAccessEmployeeWorkspace,
    logout,
  } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!canAccessEmployeeWorkspace) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, canAccessEmployeeWorkspace, router]);

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

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-10 sm:px-8 lg:px-10">
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
            Loading workspace...
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !canAccessEmployeeWorkspace) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <Link
              href="/workspace"
              className="text-xl font-semibold tracking-tight text-slate-900"
            >
              Craft Flow
            </Link>
            <p className="mt-1 text-sm text-slate-600">
              Employee workspace
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{displayName}</p>
              <p className="mt-1 text-xs text-slate-600">
                {roleLabel}
                {company?.company_name ? ` • ${company.company_name}` : ""}
              </p>
            </div>

            {canAccessAdminDashboard ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Admin dashboard
              </Link>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-10">
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <nav className="space-y-2">
            {workspaceLinks.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}