export type DashboardNavItem = {
  label: string;
  href: string;
  exact?: boolean;
};

export const dashboardNavigation: DashboardNavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    exact: true,
  },
  {
    label: "Personnel",
    href: "/dashboard/personnel",
  },
  {
    label: "Projects",
    href: "/dashboard/projects",
  },
  {
    label: "Invoices",
    href: "/dashboard/invoices",
  },
  {
    label: "Company",
    href: "/dashboard/company",
  },
];