import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  FileText,
  Users,
  Truck,
  LineChart,
  Wallet,
  Settings,
  BookText,
  Package,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/lib/db/types";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  /** Roles that can see this subitem. Omit for "all authenticated". */
  roles?: UserRole[];
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  /** Roles that can see this item. Omit for "all authenticated". */
  roles?: UserRole[];
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
  roles?: UserRole[];
}

/**
 * Full QTL nav. Call `filterSidebarByRole(role)` to get what a given role sees.
 */
export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        roles: ["owner", "manager", "accountant"],
      },
    ],
  },
  {
    id: 2,
    items: [
      {
        title: "Sales",
        url: "/sales",
        icon: ClipboardList,
        roles: ["owner", "manager", "accountant", "staff"],
      },
      {
        title: "Invoices",
        url: "/invoices",
        icon: FileText,
        roles: ["owner", "manager", "accountant"],
      },
      {
        title: "Expenses",
        url: "/expenses",
        icon: Receipt,
        roles: ["owner", "manager", "accountant", "staff"],
      },
      {
        title: "Payroll",
        url: "/payroll",
        icon: Wallet,
        roles: ["owner", "manager", "accountant"],
      },
    ],
  },
  {
    id: 3,
    items: [
      {
        title: "Customers",
        url: "/customers",
        icon: Users,
        roles: ["owner", "manager", "staff"],
      },
      {
        title: "Vendors",
        url: "/vendors",
        icon: Truck,
        roles: ["owner", "accountant", "manager"],
      },
      {
        title: "Pricing",
        url: "/pricing",
        icon: Package,
        roles: ["owner", "manager", "accountant", "staff"],
        subItems: [
          { title: "Catalog", url: "/pricing" },
          { title: "Filter price list", url: "/pricing/filters" },
          { title: "All filter sell price", url: "/pricing/all-filter-price" },
          { title: "Oil-change grid", url: "/pricing/oil-grid" },
          { title: "Oil detail", url: "/pricing/oil-detail" },
          { title: "Print list", url: "/pricing/print-list" },
        ],
      },
    ],
  },
  {
    id: 4,
    items: [
      {
        title: "Analytics",
        url: "/analytics",
        icon: LineChart,
        roles: ["owner", "manager", "accountant"],
        subItems: [
          { title: "Overview", url: "/analytics" },
          { title: "Sales & Revenue", url: "/analytics/sales" },
          { title: "Job Duration", url: "/analytics/jobs" },
          { title: "Products & Services", url: "/analytics/products" },
          { title: "Expenses", url: "/analytics/expenses" },
          { title: "Payroll", url: "/analytics/payroll", roles: ["owner", "accountant"] },
        ],
      },
      {
        title: "Reports",
        url: "/reports",
        icon: BookText,
        roles: ["owner", "manager", "accountant"],
        subItems: [
          { title: "All reports", url: "/reports" },
          { title: "Daily job report", url: "/reports/daily" },
          { title: "HST Summary", url: "/reports/hst", roles: ["owner", "accountant"] },
          { title: "P&L", url: "/reports/pnl" },
          { title: "Outstanding Invoices", url: "/reports/outstanding" },
        ],
      },
    ],
  },
  {
    id: 5,
    items: [
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
        roles: ["owner", "accountant"],
        subItems: [
          { title: "Users", url: "/settings/users", roles: ["owner"] },
          { title: "Locations", url: "/settings/locations", roles: ["owner"] },
          { title: "Expense Categories", url: "/settings/categories", roles: ["owner"] },
          { title: "Service Types", url: "/settings/services", roles: ["owner"] },
          { title: "Pricing Catalogue", url: "/settings/pricing", roles: ["owner"] },
          { title: "Recurring Expenses", url: "/settings/recurring-expenses", roles: ["owner"] },
          { title: "Statutory Rates", url: "/settings/statutory-rates", roles: ["owner"] },
          { title: "Audit Log", url: "/settings/audit-log", roles: ["owner", "accountant"] },
        ],
      },
    ],
  },
];

/**
 * Filter the nav to just what the given role is permitted to see.
 * Groups that become empty after filtering are dropped.
 */
export function filterSidebarByRole(role: UserRole | undefined): NavGroup[] {
  if (!role) return [];

  return sidebarItems
    .filter((group) => !group.roles || group.roles.includes(role))
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.roles || item.roles.includes(role))
        .map((item) => ({
          ...item,
          subItems: item.subItems?.filter((s) => !s.roles || s.roles.includes(role)),
        })),
    }))
    .filter((group) => group.items.length > 0);
}
