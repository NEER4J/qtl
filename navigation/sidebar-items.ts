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
  Boxes,
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
        roles: ["owner", "co_owner", "manager", "accountant"],
      },
    ],
  },
  {
    // Operations — day-to-day shop work.
    id: 2,
    items: [
      {
        title: "Sales",
        url: "/sales",
        icon: ClipboardList,
        roles: ["owner", "co_owner", "manager", "accountant", "staff"],
      },
      {
        title: "Customers",
        url: "/customers",
        icon: Users,
        roles: ["owner", "co_owner", "manager", "staff"],
      },
      {
        // Per-location stock counts for catalogue parts. Top-level so owner
        // (no Settings) and managers can reach it. Edit is gated server-side
        // to owner / co_owner / manager; everyone else is view-only.
        title: "Inventory",
        url: "/inventory",
        icon: Boxes,
        roles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"],
      },
      {
        title: "Vendors",
        url: "/vendors",
        icon: Truck,
        roles: ["owner", "co_owner", "accountant", "manager"],
      },
    ],
  },
  {
    // Pricing & catalogue.
    id: 3,
    items: [
      {
        title: "Pricing",
        url: "/pricing",
        icon: Package,
        roles: ["owner", "co_owner", "manager", "accountant", "staff"],
        subItems: [
          { title: "Catalog", url: "/pricing" },
          { title: "Filter price list", url: "/pricing/filters" },
          { title: "All filter sell price", url: "/pricing/all-filter-price" },
          { title: "Oil-change grid", url: "/pricing/oil-grid" },
          { title: "Oil detail", url: "/pricing/oil-detail" },
          { title: "Print list", url: "/pricing/print-list" },
          { title: "Trans & Diff", url: "/pricing/trans-diff" },
        ],
      },
      {
        // Parts / pricing CATALOGUE shortcuts. These pages live under
        // /settings/pricing, which is Admin-only — so this tile is gated to
        // co_owner (Admin). Other roles don't see it and can't open it; the
        // permission is honoured, the links are just hidden from them.
        title: "Pricing Catalogue",
        url: "/settings/pricing",
        icon: Package,
        roles: ["co_owner"],
        subItems: [
          { title: "Parts", url: "/settings/pricing/parts" },
          { title: "Packages", url: "/settings/pricing/packages" },
          { title: "Part categories", url: "/settings/pricing/categories" },
          { title: "Part brands", url: "/settings/pricing/brands" },
          { title: "Oil types", url: "/settings/pricing/oil-types" },
          { title: "Engine types", url: "/settings/pricing/engine-types" },
          { title: "Service costs", url: "/settings/pricing/service-costs" },
          { title: "Volume tiers", url: "/settings/pricing/volume-tiers" },
          { title: "Price history", url: "/settings/pricing/price-history" },
          { title: "Manage catalogue", url: "/settings/pricing" },
        ],
      },
    ],
  },
  {
    // Finance — invoicing, expenses, payroll. Below the catalogue.
    id: 4,
    items: [
      {
        title: "Invoices",
        url: "/invoices",
        icon: FileText,
        roles: ["owner", "co_owner", "manager", "accountant"],
      },
      {
        title: "Expenses",
        url: "/expenses",
        icon: Receipt,
        roles: ["owner", "co_owner", "manager", "accountant", "staff"],
      },
      {
        title: "Payroll",
        url: "/payroll",
        icon: Wallet,
        roles: ["owner", "co_owner", "manager", "accountant"],
        subItems: [
          { title: "Pay weeks", url: "/payroll" },
          { title: "Employees", url: "/payroll/employees" },
        ],
      },
      {
        title: "My Pay",
        url: "/my-pay",
        icon: Wallet,
        roles: ["manager", "supervisor", "staff", "technician"],
      },
    ],
  },
  {
    id: 5,
    items: [
      {
        title: "Analytics",
        url: "/analytics",
        icon: LineChart,
        roles: ["owner", "co_owner", "manager", "accountant"],
        subItems: [
          { title: "Overview", url: "/analytics" },
          { title: "Sales & Revenue", url: "/analytics/sales" },
          { title: "Job Duration", url: "/analytics/jobs" },
          { title: "Products & Services", url: "/analytics/products" },
          { title: "Expenses", url: "/analytics/expenses" },
          { title: "Payroll", url: "/analytics/payroll", roles: ["owner", "co_owner", "accountant"] },
        ],
      },
      {
        title: "Reports",
        url: "/reports",
        icon: BookText,
        roles: ["owner", "co_owner", "manager", "accountant"],
        subItems: [
          { title: "All reports", url: "/reports" },
          { title: "Daily job report", url: "/reports/daily" },
          { title: "HST Summary", url: "/reports/hst", roles: ["owner", "co_owner", "accountant"] },
          { title: "P&L", url: "/reports/pnl" },
          { title: "Outstanding Invoices", url: "/reports/outstanding" },
        ],
      },
    ],
  },
  {
    id: 6,
    items: [
      {
        // Settings is the Admin (co_owner) section only — owner no longer has it.
        title: "Settings",
        url: "/settings",
        icon: Settings,
        roles: ["co_owner"],
        subItems: [
          { title: "Users", url: "/settings/users", roles: ["co_owner"] },
          { title: "Locations", url: "/settings/locations", roles: ["co_owner"] },
          { title: "Expense Categories", url: "/settings/categories", roles: ["co_owner"] },
          { title: "Service Types", url: "/settings/services", roles: ["co_owner"] },
          { title: "Technicians", url: "/settings/technicians", roles: ["co_owner"] },
          { title: "Pricing Catalogue", url: "/settings/pricing", roles: ["co_owner"] },
          { title: "Promotions", url: "/settings/promotions", roles: ["co_owner"] },
          { title: "Recurring Expenses", url: "/settings/recurring-expenses", roles: ["co_owner"] },
          { title: "Statutory Rates", url: "/settings/statutory-rates", roles: ["co_owner"] },
          { title: "IP Access", url: "/settings/ip-access", roles: ["co_owner"] },
          { title: "Audit Log", url: "/settings/audit-log", roles: ["co_owner"] },
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

import { pageKeyForRequestPath } from "@/lib/permissions/registry";
import { effectiveAllowedPageKeys } from "@/lib/permissions/check";

/**
 * Filter the nav by the viewer's EFFECTIVE page permissions — the per-user
 * `allowed_pages` override when one is stored, otherwise the role defaults
 * from lib/permissions/registry.ts (the same source the permissions matrix
 * ticks and the (app) layout guard enforces).
 *
 * This deliberately does NOT intersect with the hard-coded `roles` lists on
 * each nav entry for registered pages. Doing so was the bug behind "only the
 * role defaults work": granting a user a page the matrix allows (e.g. giving
 * a staff member Vendors) still left the item hidden, because the role filter
 * ran first and stripped it. The registry is now the single source of truth
 * for anything with a registry key; the per-entry `roles` list only still
 * gates URLs that aren't registered at all (e.g. /my-pay).
 *
 * co_owner (Admin) bypasses everything.
 */
export function filterSidebar(
  role: UserRole | undefined,
  allowedPages: string[] | null | undefined,
): NavGroup[] {
  if (!role) return [];
  if (role === "co_owner") return filterSidebarByRole(role);

  const allowed = effectiveAllowedPageKeys({
    role,
    allowed_pages: allowedPages ?? null,
    hidden_columns: {},
  });

  // `pageKeyForRequestPath` (not `pageKeyForPath`) so sub-item URLs resolve to
  // their parent page: /analytics/sales → analytics, /settings/pricing/parts →
  // settings_pricing, /payroll/employees → payroll.
  const passes = (url: string, roles: UserRole[] | undefined): boolean => {
    const key = pageKeyForRequestPath(url);
    if (key) return allowed.has(key);
    return !roles || roles.includes(role); // unregistered path → role gate
  };

  return sidebarItems
    .filter((group) => !group.roles || group.roles.includes(role))
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => passes(item.url, item.roles))
        .map((item) => ({
          ...item,
          subItems: item.subItems?.filter((s) => passes(s.url, s.roles)),
        })),
    }))
    .filter((group) => group.items.length > 0);
}
