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
  { key: "dashboard", label: "Dashboard", group: "Overview", path: "/dashboard", defaultRoles: ["owner", "co_owner", "manager", "accountant"] },

  // Operations
  { key: "sales", label: "Sales", group: "Operations", path: "/sales", defaultRoles: ["owner", "co_owner", "manager", "accountant", "staff"] },
  { key: "invoices", label: "Invoices", group: "Operations", path: "/invoices", defaultRoles: ["owner", "co_owner", "manager", "accountant"] },
  { key: "expenses", label: "Expenses", group: "Operations", path: "/expenses", defaultRoles: ["owner", "co_owner", "manager", "accountant", "staff"] },
  { key: "payroll", label: "Payroll", group: "Operations", path: "/payroll", defaultRoles: ["owner", "co_owner", "manager", "accountant"] },

  // Catalog & directory
  { key: "customers", label: "Customers", group: "Catalog", path: "/customers", defaultRoles: ["owner", "co_owner", "manager", "staff"] },
  { key: "vendors", label: "Vendors", group: "Catalog", path: "/vendors", defaultRoles: ["owner", "co_owner", "accountant", "manager"] },
  { key: "pricing", label: "Pricing", group: "Catalog", path: "/pricing", defaultRoles: ["owner", "co_owner", "manager", "accountant", "staff"] },
  // Note: the sidebar's "Inventory" tile points at /settings/pricing and is
  // permission-covered by the `settings_pricing` key in the Settings group.
  // A duplicate registry entry for the same path would make pageKeyForPath
  // and pageKeyForRequestPath disagree about which key represents the URL.

  // Insights
  { key: "analytics", label: "Analytics", group: "Insights", path: "/analytics", defaultRoles: ["owner", "co_owner", "manager", "accountant"] },
  { key: "analytics_payroll", label: "Analytics — Payroll", group: "Insights", path: "/analytics/payroll", defaultRoles: ["owner", "co_owner", "accountant"] },
  { key: "reports", label: "Reports", group: "Insights", path: "/reports", defaultRoles: ["owner", "co_owner", "manager", "accountant"] },
  { key: "reports_hst", label: "Reports — HST", group: "Insights", path: "/reports/hst", defaultRoles: ["owner", "co_owner", "accountant"] },

  // Settings
  { key: "settings", label: "Settings (root)", group: "Settings", path: "/settings", defaultRoles: ["owner", "co_owner", "accountant"] },
  { key: "settings_users", label: "Users", group: "Settings", path: "/settings/users", defaultRoles: ["owner", "co_owner"] },
  { key: "settings_locations", label: "Locations", group: "Settings", path: "/settings/locations", defaultRoles: ["owner", "co_owner"] },
  { key: "settings_categories", label: "Expense Categories", group: "Settings", path: "/settings/categories", defaultRoles: ["owner", "co_owner"] },
  { key: "settings_services", label: "Service Types", group: "Settings", path: "/settings/services", defaultRoles: ["owner", "co_owner"] },
  { key: "settings_technicians", label: "Technicians", group: "Settings", path: "/settings/technicians", defaultRoles: ["owner", "co_owner"] },
  { key: "settings_pricing", label: "Pricing Catalogue", group: "Settings", path: "/settings/pricing", defaultRoles: ["owner", "co_owner"] },
  { key: "settings_recurring", label: "Recurring Expenses", group: "Settings", path: "/settings/recurring-expenses", defaultRoles: ["owner", "co_owner"] },
  { key: "settings_statutory", label: "Statutory Rates", group: "Settings", path: "/settings/statutory-rates", defaultRoles: ["owner", "co_owner"] },
  { key: "settings_audit_log", label: "Audit Log", group: "Settings", path: "/settings/audit-log", defaultRoles: ["owner", "co_owner", "accountant"] },
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
// Defaults
// ----------------------------------------------------------------------------
/** Pages a freshly-created user of this role can access by default. */
export function defaultAllowedPagesForRole(role: UserRole): string[] {
  return PAGE_REGISTRY.filter((p) => p.defaultRoles.includes(role)).map((p) => p.key);
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
  const allowed = opts.allowedPages ?? defaultAllowedPagesForRole(opts.role);
  if (allowed.includes("dashboard")) return "/dashboard";
  for (const p of PAGE_REGISTRY) {
    if (allowed.includes(p.key)) return p.path;
  }
  return null;
}
