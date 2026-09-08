import type { UserRole } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// Page registry
// ----------------------------------------------------------------------------
// One entry per "page or sub-page that an owner might want to grant or revoke
// for a specific user". Keys are stable identifiers that get persisted into
// profiles.allowed_pages, so DO NOT rename existing keys casually — that would
// orphan saved overrides.
//
// `defaultRoles` mirrors what the sidebar already grants by role. The matrix
// UI uses this to pre-tick a role's defaults when no override is stored, and
// to compute the "is this an addition or a removal vs. the role default"
// indicator.

export interface PageDef {
  key: string;
  label: string;
  group: string;
  /** Path used for nav-item matching (only — the actual URL still comes from the sidebar entry). */
  path: string;
  defaultRoles: UserRole[];
}

export const PAGE_GROUPS = [
  "Overview",
  "Operations",
  "Catalog",
  "Insights",
  "Settings",
] as const;
export type PageGroup = (typeof PAGE_GROUPS)[number];

export const PAGE_REGISTRY: PageDef[] = [
  // Overview
  // Matrix leaves Dashboard blank for every role → not granted by default.
  // owner/co_owner still reach it via bypass; other roles land on their first
  // allowed page (Sales) via defaultLandingPath.
  { key: "dashboard", label: "Dashboard", group: "Overview", path: "/dashboard", defaultRoles: ["owner", "co_owner"] },

  // Operations
  { key: "sales", label: "Sales", group: "Operations", path: "/sales", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  { key: "invoices", label: "Invoices", group: "Operations", path: "/invoices", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  { key: "expenses", label: "Expenses", group: "Operations", path: "/expenses", defaultRoles: ["owner", "co_owner", "accountant"] },
  { key: "payroll", label: "Payroll", group: "Operations", path: "/payroll", defaultRoles: ["owner", "co_owner", "accountant"] },

  // Catalog & directory
  { key: "customers", label: "Customers", group: "Catalog", path: "/customers", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  { key: "vendors", label: "Vendors", group: "Catalog", path: "/vendors", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant"] },
  { key: "pricing", label: "Pricing", group: "Catalog", path: "/pricing", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  // Pricing SUB-pages. Registered individually so the matrix can grant the
  // Pricing menu while revoking a single sheet from it — before this, every
  // /pricing/* URL resolved to the parent `pricing` key, so "Pricing but not
  // Oil detail" was not expressible. `pageKeyForRequestPath` picks the longest
  // matching prefix, so /pricing/oil-detail resolves here and not to `pricing`.
  //
  // Oil detail is owner/Admin-only by default: it exposes per-oil cost, profit
  // and margin %, which the shop does not want on the floor.
  { key: "pricing_filters", label: "Pricing — Filter price list", group: "Catalog", path: "/pricing/filters", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  { key: "pricing_all_filter_price", label: "Pricing — All filter sell price", group: "Catalog", path: "/pricing/all-filter-price", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  { key: "pricing_oil_grid", label: "Pricing — Oil-change grid", group: "Catalog", path: "/pricing/oil-grid", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  { key: "pricing_oil_detail", label: "Pricing — Oil detail", group: "Catalog", path: "/pricing/oil-detail", defaultRoles: ["owner", "co_owner"] },
  { key: "pricing_print_list", label: "Pricing — Print list", group: "Catalog", path: "/pricing/print-list", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  { key: "pricing_trans_diff", label: "Pricing — Trans & Diff", group: "Catalog", path: "/pricing/trans-diff", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  // Top-level Inventory (per-location stock counts). Viewable by everyone;
  // editing counts is gated server-side to owner / co_owner / manager.
  { key: "inventory", label: "Inventory", group: "Catalog", path: "/inventory", defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "staff", "technician"] },
  // Note: the Settings "Pricing Catalogue" tile (/settings/pricing) is covered
  // by the `settings_pricing` key in the Settings group — that's the part
  // CATALOGUE, distinct from the Inventory stock page above.

  // Insights
  // Matrix: Analytics, Reports and Reports — HST are owner/co_owner only.
  // Accounting keeps Analytics — Payroll (its one ✓ in this group).
  { key: "analytics", label: "Analytics", group: "Insights", path: "/analytics", defaultRoles: ["owner", "co_owner"] },
  { key: "analytics_payroll", label: "Analytics — Payroll", group: "Insights", path: "/analytics/payroll", defaultRoles: ["owner", "co_owner", "accountant"] },
  { key: "reports", label: "Reports", group: "Insights", path: "/reports", defaultRoles: ["owner", "co_owner"] },
  { key: "reports_hst", label: "Reports — HST", group: "Insights", path: "/reports/hst", defaultRoles: ["owner", "co_owner"] },

  // Settings
  // Matrix: every Settings row (incl. Audit Log) is ✗ by default for everyone
  // but the Admin (co_owner). `owner` is deliberately NOT in these lists — the
  // owner's default is "all pages except the Settings section", and
  // defaultAllowedPagesForRole() has to agree with that or the matrix would
  // pre-tick rows the enforcement layer then refuses. Any role (owner
  // included) can still be granted these individually via allowed_pages.
  { key: "settings", label: "Settings (root)", group: "Settings", path: "/settings", defaultRoles: ["co_owner"] },
  { key: "settings_users", label: "Users", group: "Settings", path: "/settings/users", defaultRoles: ["co_owner"] },
  { key: "settings_locations", label: "Locations", group: "Settings", path: "/settings/locations", defaultRoles: ["co_owner"] },
  { key: "settings_categories", label: "Expense Categories", group: "Settings", path: "/settings/categories", defaultRoles: ["co_owner"] },
  { key: "settings_services", label: "Service Types", group: "Settings", path: "/settings/services", defaultRoles: ["co_owner"] },
  { key: "settings_technicians", label: "Technicians", group: "Settings", path: "/settings/technicians", defaultRoles: ["co_owner"] },
  { key: "settings_pricing", label: "Pricing Catalogue", group: "Settings", path: "/settings/pricing", defaultRoles: ["co_owner"] },
  { key: "settings_promotions", label: "Promotions", group: "Settings", path: "/settings/promotions", defaultRoles: ["co_owner"] },
  { key: "settings_recurring", label: "Recurring Expenses", group: "Settings", path: "/settings/recurring-expenses", defaultRoles: ["co_owner"] },
  { key: "settings_statutory", label: "Statutory Rates", group: "Settings", path: "/settings/statutory-rates", defaultRoles: ["co_owner"] },
  { key: "settings_ip_access", label: "IP Access", group: "Settings", path: "/settings/ip-access", defaultRoles: ["co_owner"] },
  { key: "settings_audit_log", label: "Audit Log", group: "Settings", path: "/settings/audit-log", defaultRoles: ["co_owner"] },
];

const PAGE_KEY_BY_PATH = new Map(PAGE_REGISTRY.map((p) => [p.path, p.key]));
const PAGE_BY_KEY = new Map(PAGE_REGISTRY.map((p) => [p.key, p]));

export function pageKeyForPath(path: string): string | null {
  return PAGE_KEY_BY_PATH.get(path) ?? null;
}
export function pageByKey(key: string): PageDef | null {
  return PAGE_BY_KEY.get(key) ?? null;
}

/**
 * Match a request URL (which may include dynamic segments and sub-paths) to
 * the most-specific registered page. `/sales/123/edit` → `sales`,
 * `/settings/pricing/parts` → `settings_pricing` (the longest prefix wins).
 * Returns null for paths that aren't registered (utility routes etc.) — those
 * are intentionally not permission-gated.
 */
export function pageKeyForRequestPath(pathname: string): string | null {
  let best: PageDef | null = null;
  for (const p of PAGE_REGISTRY) {
    if (pathname === p.path || pathname.startsWith(p.path + "/")) {
      if (!best || p.path.length > best.path.length) best = p;
    }
  }
  return best?.key ?? null;
}

// ----------------------------------------------------------------------------
// Column registry
// ----------------------------------------------------------------------------
// One entry per table where the owner can hide columns for a given user.
//
// IMPORTANT: every key listed here MUST correspond to a column the matching
// list table actually renders behind a `show(key)` / `visible(key)` guard.
// Listing a column the table doesn't gate produces a toggle in the matrix
// that silently does nothing — confusing for the owner. These lists are the
// columns currently enforced in the *list* views (detail-page columns are not
// hideable yet; that would be a separate feature).

export interface ColumnDef {
  key: string;
  label: string;
  /** Human hint describing what hiding this column achieves. */
  hint?: string;
}

export interface PageColumns {
  pageKey: string;
  columns: ColumnDef[];
}

export const COLUMN_REGISTRY: PageColumns[] = [
  {
    pageKey: "settings_users",
    columns: [
      // "email" used to live here as its own column. After the Login/Email
      // merge it doesn't exist as a standalone column — any saved override
      // referencing it is now a silent no-op.
      { key: "role", label: "Role" },
      { key: "location", label: "Location" },
      { key: "expenses", label: "Expenses flag" },
      { key: "status", label: "Status" },
      { key: "password", label: "Password (stored)", hint: "Plaintext last-set password column." },
      { key: "last_login", label: "Last login" },
    ],
  },
  {
    pageKey: "sales",
    columns: [
      { key: "invoice_no", label: "Invoice no." },
      { key: "customer", label: "Customer" },
      { key: "vehicle", label: "Vehicle / plate" },
      { key: "bay", label: "Bay" },
      { key: "total", label: "Total" },
      { key: "paid", label: "Paid" },
      { key: "outstanding", label: "Outstanding" },
      { key: "payment_status", label: "Payment status" },
    ],
  },
  {
    pageKey: "expenses",
    columns: [
      { key: "category", label: "Category" },
      { key: "subcategory", label: "Sub-category" },
      { key: "vendor", label: "Vendor" },
      { key: "invoice_no", label: "Invoice no." },
      { key: "total", label: "Total" },
      { key: "paid", label: "Paid" },
      { key: "balance", label: "Balance" },
    ],
  },
  {
    pageKey: "customers",
    columns: [
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
    ],
  },
  {
    pageKey: "vendors",
    columns: [
      { key: "category", label: "Category" },
      { key: "account_no", label: "Account no." },
      { key: "contact", label: "Phone / contact" },
      { key: "email", label: "Email" },
    ],
  },
  {
    pageKey: "payroll",
    columns: [
      { key: "hours", label: "Reg hours" },
      { key: "overtime", label: "Overtime hours" },
      { key: "gross", label: "Gross wages" },
      { key: "holiday_vacation", label: "Holiday + Vacation" },
      { key: "ei_cpp", label: "EI + CPP" },
      { key: "income_tax", label: "Income tax" },
      { key: "benefits", label: "Employer remit (EI/CPP/WSIB)" },
      { key: "net_pay", label: "Net pay" },
    ],
  },
];

const COLUMN_BY_PAGE = new Map(COLUMN_REGISTRY.map((p) => [p.pageKey, p]));
export function columnsForPage(pageKey: string): ColumnDef[] {
  return COLUMN_BY_PAGE.get(pageKey)?.columns ?? [];
}

// ----------------------------------------------------------------------------
// Action registry
// ----------------------------------------------------------------------------
// The third permission axis, alongside pages and columns: things a user can DO
// on a page they can otherwise see. Pages answer "can you open it", columns
// answer "what can you read", actions answer "what can you take away with you".
//
// Keys are persisted into profiles.allowed_actions, so DO NOT rename existing
// ones casually. Every action belongs to a `pageKey`; an action is only ever
// permitted when the page it lives on is also permitted (enforced in
// lib/permissions/check.ts), so revoking a page implicitly revokes its actions.
//
// IMPORTANT: an entry here is only real once BOTH the UI control and its
// server route check it. A registry entry with an ungated API route is a
// hidden button, not a permission.

export interface ActionDef {
  key: string;
  label: string;
  /** Registry page key this action belongs to. */
  pageKey: string;
  /** Human hint describing what revoking this action achieves. */
  hint?: string;
  defaultRoles: UserRole[];
}

export const ACTION_REGISTRY: ActionDef[] = [
  {
    key: "customers.export",
    label: "Export CSV",
    pageKey: "customers",
    hint: "Download the entire customer directory — every name, phone and email — as a spreadsheet.",
    defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "technician"],
  },
  {
    key: "inventory.export",
    label: "Export CSV",
    pageKey: "inventory",
    hint: "Download on-hand part and oil stock for every location as a spreadsheet.",
    defaultRoles: ["owner", "co_owner", "manager", "supervisor", "accountant", "technician"],
  },
];

const ACTION_BY_KEY = new Map(ACTION_REGISTRY.map((a) => [a.key, a]));
export function actionByKey(key: string): ActionDef | null {
  return ACTION_BY_KEY.get(key) ?? null;
}
export function actionsForPage(pageKey: string): ActionDef[] {
  return ACTION_REGISTRY.filter((a) => a.pageKey === pageKey);
}

// ----------------------------------------------------------------------------
// Defaults
// ----------------------------------------------------------------------------
/** Pages a freshly-created user of this role can access by default. */
export function defaultAllowedPagesForRole(role: UserRole): string[] {
  return PAGE_REGISTRY.filter((p) => p.defaultRoles.includes(role)).map((p) => p.key);
}

/** Actions a freshly-created user of this role can perform by default. */
export function defaultAllowedActionsForRole(role: UserRole): string[] {
  return ACTION_REGISTRY.filter((a) => a.defaultRoles.includes(role)).map((a) => a.key);
}

/**
 * Compute where a freshly-signed-in user should land. Prefers /dashboard when
 * they can reach it, otherwise the first page in registry order that their
 * effective allowlist permits. Returns null only for accounts with literally
 * no accessible app page (e.g. `employee`, which has no registry entries).
 *
 * Portal customers always land in the customer portal, independent of the
 * (app)-side registry.
 */
export function defaultLandingPath(opts: {
  role: UserRole;
  allowedPages: string[] | null | undefined;
}): string | null {
  if (opts.role === "portal_customer") return "/portal/invoices";
  // The Admin (co_owner) bypasses allowed_pages everywhere else, so a stale
  // override must not decide their landing page either.
  if (opts.role === "co_owner") return "/dashboard";
  const allowed = opts.allowedPages ?? defaultAllowedPagesForRole(opts.role);
  if (allowed.includes("dashboard")) return "/dashboard";
  for (const p of PAGE_REGISTRY) {
    if (allowed.includes(p.key)) return p.path;
  }
  return null;
}
