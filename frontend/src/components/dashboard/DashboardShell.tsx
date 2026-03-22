"use client";

import DashboardSidebar from "./DashboardSidebar";
import DashboardTopbar from "./DashboardTopbar";

type DashboardShellProps = {
  title: string;
  description?: string;
  companyName?: string;
  role?: string;
  userName?: string;
  onLogout?: () => void;
  children: React.ReactNode;
};

export default function DashboardShell({
  title,
  description,
  companyName,
  role,
  userName,
  onLogout,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        
        {/* MAIN GRID */}
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          
          {/* SIDEBAR */}
          <DashboardSidebar
            companyName={companyName}
            role={role}
          />

          {/* CONTENT AREA */}
          <div className="min-w-0 space-y-6">
            
            {/* TOPBAR */}
            <DashboardTopbar
              title={title}
              description={description}
              userName={userName}
              onLogout={onLogout}
            />

            {/* PAGE CONTENT */}
            <div className="min-w-0">
              {children}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}