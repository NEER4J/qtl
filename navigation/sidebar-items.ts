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
  /**
   * Roles that can see this entry.
   *
   * ONLY consulted for URLs with no entry in PAGE_REGISTRY — in practice just
   * /my-pay. For everything else `filterSidebar()` resolves the URL to a
   * registry key and asks the permissions layer, so a `roles` list here is a
   * second, silently-ignored source of truth. Two had already drifted out of
   * step with the registry (Dashboard and Vendors each listed roles the
   * registry does not grant), which is the confusion this rule prevents: to
   * change who sees a registered page, edit its `defaultRoles` in
   * lib/permissions/registry.ts.
   */
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
  /** Roles that can see this item. See NavSubItem.roles — registry first. */
  roles?: UserRole[];
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
  roles?: UserRole[];
}

/**
 * Full QTL nav. Call `filterSidebar(role, allowedPages)` — it resolves each
 * URL to a PAGE_REGISTRY key and asks the permissions layer, so visibility is
 * decided in ONE place. `filterSidebarByRole` is the role-only fallback, used
 * for co_owner (who sees everything anyway).
 */
export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
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
      },
      {
        title: "Customers",
        url: "/customers",
        icon: Users,
      },
      {
        // Per-location stock counts for catalogue parts. Top-level so owner
        // (no Settings) and managers can reach it. Edit is gated server-side
        // to owner / co_owner / manager; everyone else is view-only.
        title: "Inventory",
        url: "/inventory",
        icon: Boxes,
      },
      {
        title: "Vendors",
        url: "/vendors",
        icon: Truck,
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
        // /settings/pricing, whose registry entry is Admin-only — so the whole
        // tile disappears for everyone else via the registry lookup. Distinct
        // from the Pricing menu above, which is the price SHEETS.
        title: "Pricing Catalogue",
        url: "/settings/pricing",
        icon: Package,
        subItems: [
          { title: "Parts", url: "/settings/pricing/parts" },
          { title: "Packages", url: "/settings/pricing/packages" },
          { title: "Part categories", url: "/settings/pricing/categories" },
          { title: "Part brands", url: "/settings/pricing/brands" },
          { title: "Oil types", url: "/settings/pricing/oil-types" },
          { title: "Oil groups", url: "/settings/pricing/oil-groups" },
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
      },
      {
        title: "Expenses",
        url: "/expenses",
        icon: Receipt,
      },
      {
        title: "Payroll",
        url: "/payroll",
        icon: Wallet,
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
        subItems: [
          { title: "Overview", url: "/analytics" },
          { title: "Sales & Revenue", url: "/analytics/sales" },
          { title: "Job Duration", url: "/analytics/jobs" },
          { title: "Products & Services", url: "/analytics/products" },
          { title: "Expenses", url: "/analytics/expenses" },
          { title: "Payroll", url: "/analytics/payroll" },
        ],
      },
      {
        title: "Reports",
        url: "/reports",
        icon: BookText,
        subItems: [
          { title: "All reports", url: "/reports" },
          { title: "Daily job report", url: "/reports/daily" },
          { title: "HST Summary", url: "/reports/hst" },
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
        subItems: [
          { title: "Users", url: "/settings/users" },
          { title: "Locations", url: "/settings/locations" },
          { title: "Expense Categories", url: "/settings/categories" },
          { title: "Service Types", url: "/settings/services" },
          { title: "Technicians", url: "/settings/technicians" },
          { title: "Pricing Catalogue", url: "/settings/pricing" },
          { title: "Promotions", url: "/settings/promotions" },
          { title: "Recurring Expenses", url: "/settings/recurring-expenses" },
          { title: "Statutory Rates", url: "/settings/statutory-rates" },
          { title: "IP Access", url: "/settings/ip-access" },
          { title: "Audit Log", url: "/settings/audit-log" },
        ],
      },
    ],
  },
];

/**
 * Role-only filter. Groups that become empty after filtering are dropped.
 *
 * Use `filterSidebar()` instead unless you specifically want to bypass the
 * per-user allowlist. Since the `roles` lists were removed from every entry
 * whose URL is registered (they were dead weight — see NavSubItem.roles), this
 * function now returns nearly the whole nav for ANY role. That is correct for
 * its one caller, co_owner, and wrong for everyone else.
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
        .map((item) => {
          const subItems = item.subItems?.filter((s) => passes(s.url, s.roles));
          // Collapse an emptied list back to undefined — nav-main renders an
          // item with `subItems` as a collapsible trigger, so an empty array
          // would leave a menu that opens onto nothing.
          return { ...item, subItems: subItems?.length ? subItems : undefined };
        })
        // A parent survives if its OWN page is allowed, or if any of its
        // sub-items survived. Filtering the parent on its own URL alone hid
        // whole menus whose children were granted: giving someone
        // `settings_users` without the `settings` root key removed the entire
        // Settings menu, so the page they'd been granted was unreachable from
        // the nav. Parents with sub-items render as a collapsible trigger
        // rather than a link, so keeping one costs no access.
        .filter(
          (item) =>
            passes(item.url, item.roles) || (item.subItems?.length ?? 0) > 0,
        ),
    }))
    .filter((group) => group.items.length > 0);
}
