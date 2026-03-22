import PersonnelSubnav from "@/components/dashboard/PersonnelSubnav";

export default function PersonnelVacationsPage() {
  return (
    <div className="space-y-6">
      <PersonnelSubnav />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Vacations</h2>
        <p className="mt-2 text-sm text-slate-600">
          This personnel area will contain vacation requests, balances, approval
          workflows, and employee absence visibility for the current company.
        </p>
      </section>
    </div>
  );
}