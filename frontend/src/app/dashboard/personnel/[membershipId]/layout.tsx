import EmployeeDetailTabs from "@/components/dashboard/EmployeeDetailTabs";

export default function EmployeeDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <EmployeeDetailTabs />
      {children}
    </div>
  );
}