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
  UserCircle,
  BookText,
  Package,
  HelpCircle,
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
    label: "Overview",
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
    label: "Operations",
    items: [
      {
        title: "Sales",
        url: "/sales",
        icon: ClipboardList,
        roles: ["owner", "manager", "accountant", "staff"],
        subItems: [
          { title: "All Jobs", url: "/sales" },
          { title: "New Job", url: "/sales/new", roles: ["owner", "manager", "staff"] },
        ],
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
        subItems: [
          { title: "All Expenses", url: "/expenses" },
          { title: "New Expense", url: "/expenses/new", roles: ["owner", "manager", "accountant", "staff"] },
        ],
      },
      {
        title: "Payroll",
        url: "/payroll",
        icon: Wallet,
        roles: ["owner", "manager", "accountant"],
        subItems: [
          { title: "Pay weeks", url: "/payroll" },
          { title: "New week", url: "/payroll", roles: ["owner", "manager"] },
        ],
      },
    ],
  },
  {
    id: 3,
    label: "Directory",
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
          { title: "Oil-change grid", url: "/pricing/oil-grid" },
          { title: "Manage catalogue", url: "/settings/pricing", roles: ["owner"] },
          { title: "Oil types", url: "/settings/pricing/oil-types", roles: ["owner"] },
          { title: "Engine types", url: "/settings/pricing/engine-types", roles: ["owner"] },
          { title: "Parts", url: "/settings/pricing/parts", roles: ["owner"] },
          { title: "Packages", url: "/settings/pricing/packages", roles: ["owner"] },
          { title: "Part categories", url: "/settings/pricing/categories", roles: ["owner"] },
          { title: "Part brands", url: "/settings/pricing/brands", roles: ["owner"] },
          { title: "Service costs", url: "/settings/pricing/service-costs", roles: ["owner"] },
          { title: "Volume tiers", url: "/settings/pricing/volume-tiers", roles: ["owner"] },
          { title: "Price history", url: "/settings/pricing/price-history", roles: ["owner"] },
        ],
      },
    ],
  },
  {
    id: 4,
    label: "Analytics",
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
    label: "Administration",
    items: [
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
        roles: ["owner"],
        subItems: [
          { title: "Users", url: "/settings/users" },
          { title: "Locations", url: "/settings/locations" },
          { title: "Expense Categories", url: "/settings/categories" },
          { title: "Service Types", url: "/settings/services" },
          { title: "Pricing Catalogue", url: "/settings/pricing" },
          { title: "Recurring Expenses", url: "/settings/recurring-expenses" },
          { title: "Statutory Rates", url: "/settings/statutory-rates" },
          { title: "Audit Log", url: "/settings/audit-log", roles: ["owner", "accountant"] },
        ],
      },
      {
        title: "Help",
        url: "/help",
        icon: HelpCircle,
      },
      {
        title: "Profile",
        url: "/profile",
        icon: UserCircle,
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
