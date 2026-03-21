type AppShellProps = {
  title?: string;
  children: React.ReactNode;
};

export default function AppShell({
  title = "Dashboard",
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <h1 className="text-xl font-bold text-slate-900">Craft Flow</h1>
            <p className="mt-1 text-sm text-slate-500">SaaS Admin Panel</p>
          </div>

          <nav className="flex-1 px-4 py-6">
            <ul className="space-y-2">
              <li className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900">
                Dashboard
              </li>
              <li className="rounded-xl px-4 py-3 text-sm text-slate-600">
                Companies
              </li>
              <li className="rounded-xl px-4 py-3 text-sm text-slate-600">
                Employees
              </li>
              <li className="rounded-xl px-4 py-3 text-sm text-slate-600">
                Worktime
              </li>
              <li className="rounded-xl px-4 py-3 text-sm text-slate-600">
                Vacations
              </li>
              <li className="rounded-xl px-4 py-3 text-sm text-slate-600">
                Invoices
              </li>
            </ul>
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Welcome to your management area.
                </p>
              </div>

              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                Admin
              </div>
            </div>
          </header>

          <main className="flex-1 p-5 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}