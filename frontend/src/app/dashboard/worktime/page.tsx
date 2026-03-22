import PersonnelSubnav from "@/components/dashboard/PersonnelSubnav";

export default function PersonnelWorktimePage() {
  return (
    <div className="space-y-6">
      <PersonnelSubnav />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Worktime</h2>
        <p className="mt-2 text-sm text-slate-600">
          This personnel area will contain attendance, tracked hours, time
          entries, and later approval-related worktime details for employees in
          the current company.
        </p>
      </section>
    </div>
  );
}