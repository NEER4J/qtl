// Tables the Admin's "Download backup" exports, one CSV each (client call
// 2026-11-19: "if the system crashes we need our data — a daily or
// every-other-day backup"). The database itself is backed up by Supabase;
// this is the shop's own copy on their own computer.
//
// `order` must make the paging stable (unique per row), so tables without an
// `id` list their primary-key columns.
//
// Left out on purpose: audit_log (350k+ rows of change history, too big for
// one download and not needed to restore the business), profile_credentials
// and customer_portal_access (login secrets), migration_source (empty).

export interface BackupTable {
  name: string;
  label: string;
  order: string[];
}

export const BACKUP_TABLES: BackupTable[] = [
  { name: "customers", label: "Customers", order: ["id"] },
  { name: "vehicles", label: "Vehicles", order: ["id"] },
  { name: "sales_jobs", label: "Sales jobs (invoices)", order: ["id"] },
  { name: "sales_job_items", label: "Sales job lines", order: ["id"] },
  { name: "sales_payments", label: "Sales payments", order: ["id"] },
  { name: "customer_credit_ledger", label: "Store credit ledger", order: ["id"] },
  { name: "vendors", label: "Vendors", order: ["id"] },
  { name: "vendor_locations", label: "Vendor locations", order: ["id"] },
  { name: "vendor_location_accounts", label: "Vendor accounts", order: ["id"] },
  { name: "expenses", label: "Expenses", order: ["id"] },
  { name: "expense_items", label: "Expense lines", order: ["id"] },
  { name: "expense_payments", label: "Expense payments", order: ["id"] },
  { name: "expense_categories", label: "Expense categories", order: ["id"] },
  { name: "expense_subcategories", label: "Expense subcategories", order: ["id"] },
  { name: "recurring_expenses", label: "Recurring expenses", order: ["id"] },
  { name: "parts", label: "Parts", order: ["id"] },
  { name: "part_categories", label: "Part categories", order: ["id"] },
  { name: "part_brands", label: "Part brands", order: ["id"] },
  { name: "part_packages", label: "Packages", order: ["id"] },
  { name: "part_package_items", label: "Package items", order: ["id"] },
  { name: "part_location_stock", label: "Part stock by location", order: ["part_id", "location_id"] },
  { name: "part_location_limits", label: "Part min / max by location", order: ["part_id", "location_id"] },
  { name: "oil_types", label: "Oil types", order: ["id"] },
  { name: "oil_groups", label: "Oil groups", order: ["id"] },
  { name: "oil_location_stock", label: "Oil stock by location", order: ["oil_type_id", "location_id"] },
  { name: "oil_location_limits", label: "Oil min / max by location", order: ["oil_type_id", "location_id"] },
  { name: "engine_types", label: "Engine types", order: ["id"] },
  { name: "engine_filters", label: "Engine filters", order: ["id"] },
  { name: "engine_filter_options", label: "Engine filter options", order: ["id"] },
  { name: "engine_sell_prices", label: "Engine sell prices", order: ["id"] },
  { name: "transmission_services", label: "Trans & Diff services", order: ["id"] },
  { name: "service_costs", label: "Service costs", order: ["id"] },
  { name: "service_types", label: "Service types", order: ["id"] },
  { name: "volume_tiers", label: "Volume tiers", order: ["id"] },
  { name: "promotions", label: "Promotions", order: ["id"] },
  { name: "price_history", label: "Price history", order: ["id"] },
  { name: "employees", label: "Payroll employees", order: ["id"] },
  { name: "payroll_weeks", label: "Payroll weeks", order: ["id"] },
  { name: "payroll_entries", label: "Payroll entries", order: ["id"] },
  { name: "payroll_payments", label: "Payroll payments", order: ["id"] },
  { name: "payroll_cash_daily", label: "Payroll cash (daily)", order: ["id"] },
  { name: "statutory_rates", label: "Statutory rates", order: ["id"] },
  { name: "technicians", label: "Technicians", order: ["id"] },
  { name: "locations", label: "Locations", order: ["id"] },
  { name: "profiles", label: "Users", order: ["id"] },
  { name: "app_settings", label: "App settings", order: ["id"] },
  { name: "invoice_counters", label: "Invoice counters", order: ["location_id", "year_month"] },
  { name: "stock_transfers", label: "Stock transfers", order: ["id"] },
];

export const BACKUP_TABLE_BY_NAME = new Map(BACKUP_TABLES.map((t) => [t.name, t]));
