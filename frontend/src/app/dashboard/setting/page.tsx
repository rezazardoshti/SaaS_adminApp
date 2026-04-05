export default function SettingsPage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Manage your workspace preferences, account settings, and company
          configuration.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-medium text-slate-800">
            Account settings
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Update your personal information, password, and security options.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-medium text-slate-800">
            Company settings
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Configure company details, roles, and workspace behavior.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-medium text-slate-800">
            Notifications
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Control how and when you receive updates from the system.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-medium text-slate-800">
            System preferences
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Customize UI behavior, language, and workspace experience.
          </p>
        </div>
      </div>
    </section>
  );
}