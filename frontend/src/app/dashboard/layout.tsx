"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { useAuth } from "@/context/AuthContext";

function getPageMeta(pathname: string) {
  if (pathname === "/dashboard") {
    return {
      title: "Company Overview",
      description:
        "See the most important company signals, operational numbers, and the current workspace status.",
    };
  }

  if (pathname === "/dashboard/personnel") {
    return {
      title: "Personnel",
      description:
        "Manage employees, memberships, and personnel-related company data.",
    };
  }

  if (pathname.startsWith("/dashboard/personnel/worktime")) {
    return {
      title: "Personnel / Worktime",
      description:
        "Review attendance, tracked time, and personnel-related worktime information.",
    };
  }

  if (pathname.startsWith("/dashboard/personnel/vacations")) {
    return {
      title: "Personnel / Vacations",
      description:
        "Review vacation requests, balances, and approval-related personnel planning.",
    };
  }

  if (pathname.startsWith("/dashboard/personnel/documents")) {
    return {
      title: "Personnel / Documents",
      description:
        "Access personnel-related files and document visibility within the company.",
    };
  }

  if (pathname.startsWith("/dashboard/projects")) {
    return {
      title: "Projects",
      description:
        "Review operational workload, active projects, and related assignments.",
    };
  }

  if (pathname.startsWith("/dashboard/invoices")) {
    return {
      title: "Invoices",
      description:
        "Monitor invoice visibility, open items, and finance-related follow-up.",
    };
  }

  if (pathname.startsWith("/dashboard/company")) {
    return {
      title: "Company",
      description:
        "See company profile information and workspace-level business details.",
    };
  }

  return {
    title: "Dashboard",
    description: "Company workspace",
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const pageMeta = useMemo(() => getPageMeta(pathname), [pathname]);

  const displayName = useMemo(() => {
    return (
      user?.full_name?.trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      user?.email ||
      "User"
    );
  }, [user]);

  return (
    <ProtectedRoute>
      <DashboardShell
        title={pageMeta.title}
        description={pageMeta.description}
        companyName="Company"
        role="member"
        userName={displayName}
        onLogout={logout}
      >
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}