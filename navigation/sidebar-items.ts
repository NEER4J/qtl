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
    id: 2,
    items: [
      {
        title: "Sales",
        url: "/sales",
        icon: ClipboardList,
        roles: ["owner", "co_owner", "manager", "accountant", "staff"],
      },
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
        roles: ["owner", "co_owner", "manager", "staff"],
      },
      {
        title: "Vendors",
        url: "/vendors",
        icon: Truck,
        roles: ["owner", "co_owner", "accountant", "manager"],
      },
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
        // Per-location stock counts for catalogue parts. Top-level so owner
        // (no Settings) and managers can reach it. Edit is gated server-side
        // to owner / co_owner / manager; everyone else is view-only.
        title: "Inventory",
        url: "/inventory",
        icon: Boxes,
        roles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"],
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
    id: 4,
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
    id: 5,
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
          { title: "Recurring Expenses", url: "/settings/recurring-expenses", roles: ["co_owner"] },
          { title: "Statutory Rates", url: "/settings/statutory-rates", roles: ["co_owner"] },
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

import { pageKeyForPath } from "@/lib/permissions/registry";

/**
 * Filter the nav using BOTH the role's default allowlist and the user's
 * per-user `allowed_pages` override (if present). Owner bypasses everything.
 *
 * `allowedPages = null` means "use the role's defaults" (the old behaviour).
 * `allowedPages = string[]` is the explicit allowlist of page keys (from
 *  lib/permissions/registry.ts) — items whose path is registered AND not in
 *  the list get hidden. Unregistered paths (utility/internal) pass through.
 */
export function filterSidebar(
  role: UserRole | undefined,
  allowedPages: string[] | null | undefined,
): NavGroup[] {
  if (!role) return [];
  // Owner and co_owner are driven purely by role-based nav (no per-user
  // override allowlist). co_owner (Admin) sees everything; owner sees
  // everything its role grants — which now excludes the Settings section.
  if (role === "owner" || role === "co_owner") return filterSidebarByRole(role);

  const overrideSet = allowedPages ? new Set(allowedPages) : null;

  const passesOverride = (url: string): boolean => {
    if (!overrideSet) return true; // no override -> role default already filtered.
    const key = pageKeyForPath(url);
    if (!key) return true; // unregistered path -> let role filter handle it.
    return overrideSet.has(key);
  };

  return filterSidebarByRole(role)
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => passesOverride(item.url))
        .map((item) => ({
          ...item,
          subItems: item.subItems?.filter((s) => passesOverride(s.url)),
        })),
    }))
    .filter((group) => group.items.length > 0);
}
