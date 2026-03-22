export type PersonnelNavItem = {
  label: string;
  href: string;
  exact?: boolean;
};

export const personnelNavigation: PersonnelNavItem[] = [
  {
    label: "Employees",
    href: "/dashboard/personnel",
    exact: true,
  },
  {
    label: "Worktime",
    href: "/dashboard/personnel/worktime",
  },
  {
    label: "Vacations",
    href: "/dashboard/personnel/vacations",
  },
  {
    label: "Documents",
    href: "/dashboard/personnel/documents",
  },
];