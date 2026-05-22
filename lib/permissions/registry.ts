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
  { key: "dashboard", label: "Dashboard", group: "Overview", path: "/dashboard", defaultRoles: ["owner", "manager", "accountant"] },

  // Operations
  { key: "sales", label: "Sales", group: "Operations", path: "/sales", defaultRoles: ["owner", "manager", "accountant", "staff"] },
  { key: "invoices", label: "Invoices", group: "Operations", path: "/invoices", defaultRoles: ["owner", "manager", "accountant"] },
  { key: "expenses", label: "Expenses", group: "Operations", path: "/expenses", defaultRoles: ["owner", "manager", "accountant", "staff"] },
  { key: "payroll", label: "Payroll", group: "Operations", path: "/payroll", defaultRoles: ["owner", "manager", "accountant"] },

  // Catalog & directory
  { key: "customers", label: "Customers", group: "Catalog", path: "/customers", defaultRoles: ["owner", "manager", "staff"] },
  { key: "vendors", label: "Vendors", group: "Catalog", path: "/vendors", defaultRoles: ["owner", "accountant", "manager"] },
  { key: "pricing", label: "Pricing", group: "Catalog", path: "/pricing", defaultRoles: ["owner", "manager", "accountant", "staff"] },
  { key: "inventory", label: "Inventory", group: "Catalog", path: "/settings/pricing", defaultRoles: ["owner"] },

  // Insights
  { key: "analytics", label: "Analytics", group: "Insights", path: "/analytics", defaultRoles: ["owner", "manager", "accountant"] },
  { key: "analytics_payroll", label: "Analytics — Payroll", group: "Insights", path: "/analytics/payroll", defaultRoles: ["owner", "accountant"] },
  { key: "reports", label: "Reports", group: "Insights", path: "/reports", defaultRoles: ["owner", "manager", "accountant"] },
  { key: "reports_hst", label: "Reports — HST", group: "Insights", path: "/reports/hst", defaultRoles: ["owner", "accountant"] },

  // Settings
  { key: "settings", label: "Settings (root)", group: "Settings", path: "/settings", defaultRoles: ["owner", "accountant"] },
  { key: "settings_users", label: "Users", group: "Settings", path: "/settings/users", defaultRoles: ["owner"] },
  { key: "settings_locations", label: "Locations", group: "Settings", path: "/settings/locations", defaultRoles: ["owner"] },
  { key: "settings_categories", label: "Expense Categories", group: "Settings", path: "/settings/categories", defaultRoles: ["owner"] },
  { key: "settings_services", label: "Service Types", group: "Settings", path: "/settings/services", defaultRoles: ["owner"] },
  { key: "settings_pricing", label: "Pricing Catalogue", group: "Settings", path: "/settings/pricing", defaultRoles: ["owner"] },
  { key: "settings_recurring", label: "Recurring Expenses", group: "Settings", path: "/settings/recurring-expenses", defaultRoles: ["owner"] },
  { key: "settings_statutory", label: "Statutory Rates", group: "Settings", path: "/settings/statutory-rates", defaultRoles: ["owner"] },
  { key: "settings_audit_log", label: "Audit Log", group: "Settings", path: "/settings/audit-log", defaultRoles: ["owner", "accountant"] },
];

const PAGE_KEY_BY_PATH = new Map(PAGE_REGISTRY.map((p) => [p.path, p.key]));
const PAGE_BY_KEY = new Map(PAGE_REGISTRY.map((p) => [p.key, p]));

export function pageKeyForPath(path: string): string | null {
  return PAGE_KEY_BY_PATH.get(path) ?? null;
}
export function pageByKey(key: string): PageDef | null {
  return PAGE_BY_KEY.get(key) ?? null;
}

// ----------------------------------------------------------------------------
// Column registry
// ----------------------------------------------------------------------------
// One entry per table where the owner can hide columns for a given user.
// `defaultHiddenFor` (optional) is purely advisory text for the UI — used to
// say "Staff usually don't see this".

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
      { key: "email", label: "Email" },
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
      { key: "vehicle", label: "Vehicle" },
      { key: "bay", label: "Bay" },
      { key: "tech", label: "Technicians" },
      { key: "sub_total", label: "Subtotal" },
      { key: "hst", label: "HST" },
      { key: "total", label: "Total" },
      { key: "paid", label: "Paid" },
      { key: "outstanding", label: "Outstanding" },
      { key: "payment_mode", label: "Payment mode" },
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
      { key: "sub_total", label: "Subtotal" },
      { key: "hst", label: "HST" },
      { key: "total", label: "Total" },
      { key: "paid", label: "Paid" },
      { key: "balance", label: "Balance" },
      { key: "payment_mode", label: "Payment mode" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    pageKey: "customers",
    columns: [
      { key: "code", label: "Customer code" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "address", label: "Address" },
      { key: "discount", label: "Discounts" },
      { key: "card_number", label: "Card number" },
      { key: "free_offers", label: "Free offers" },
    ],
  },
  {
    pageKey: "vendors",
    columns: [
      { key: "code", label: "Vendor code" },
      { key: "category", label: "Category" },
      { key: "account_no", label: "Account no." },
      { key: "contact", label: "Contact" },
      { key: "email", label: "Email" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    pageKey: "payroll",
    columns: [
      { key: "hours", label: "Hours" },
      { key: "rate", label: "Rate" },
      { key: "gross", label: "Gross wages" },
      { key: "overtime", label: "Overtime" },
      { key: "holiday_vacation", label: "Holiday + Vacation" },
      { key: "bonus", label: "Bonus" },
      { key: "misc_extra", label: "Misc/Extra" },
      { key: "ei_cpp", label: "EI + CPP" },
      { key: "income_tax", label: "Income tax" },
      { key: "benefits", label: "Benefits" },
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
