"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const tabs = [
  {
    label: "Profile",
    getHref: (membershipId: string) => `/dashboard/personnel/${membershipId}`,
  },
  {
    label: "Worktime",
    getHref: (membershipId: string) =>
      `/dashboard/personnel/${membershipId}/worktime`,
  },
  {
    label: "Documents",
    getHref: (membershipId: string) =>
      `/dashboard/personnel/${membershipId}/documents`,
  },
  {
    label: "Vacations",
    getHref: (membershipId: string) =>
      `/dashboard/personnel/${membershipId}/vacations`,
  },
];

function isTabActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function EmployeeDetailTabs() {
  const pathname = usePathname();
  const params = useParams();

  const membershipId = Array.isArray(params?.membershipId)
    ? params.membershipId[0]
    : params?.membershipId;

  if (!membershipId || typeof membershipId !== "string") {
    return null;
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
      <nav className="flex flex-wrap gap-2" aria-label="Employee detail tabs">
        {tabs.map((tab) => {
          const href = tab.getHref(membershipId);
          const active = isTabActive(pathname, href);

          return (
            <Link
              key={tab.label}
              href={href}
              className={[
                "rounded-2xl px-4 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}