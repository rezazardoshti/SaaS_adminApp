"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNavigation } from "./dashboard-navigation";

type DashboardSidebarProps = {
  companyName?: string;
  role?: string;
};

function isItemActive(
  pathname: string,
  href: string,
  exact?: boolean
): boolean {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardSidebar({
  companyName,
  role,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-full rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-6">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Company workspace
        </p>

        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          {companyName || "Company"}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Signed in role: <span className="font-medium text-slate-700">{role || "-"}</span>
        </p>
      </div>

      <nav className="mt-4">
        <ul className="space-y-2">
          {dashboardNavigation.map((item) => {
            const active = isItemActive(pathname, item.href, item.exact);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Scope
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This area is limited to the currently signed-in company account only.
        </p>
      </div>
    </aside>
  );
}