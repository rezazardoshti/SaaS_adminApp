"use client";

type DashboardTopbarProps = {
  title: string;
  description?: string;
  userName?: string;
  onLogout?: () => void;
};

export default function DashboardTopbar({
  title,
  description,
  userName,
  onLogout,
}: DashboardTopbarProps) {
  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Dashboard
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>

          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {userName || "User"}
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}