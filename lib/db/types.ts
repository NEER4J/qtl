// Hand-rolled placeholder. Replace with:
//   supabase gen types typescript --local > lib/db/types.ts
// once `supabase start` has applied the migrations.

export type UserRole = 'owner' | 'co_owner' | 'manager' | 'supervisor' | 'accountant' | 'staff' | 'technician' | 'employee' | 'portal_customer';

export type PaymentMode =
  | 'visa'
  | 'mastercard'
  | 'debit'
  | 'cash'
  | 'cheque'
  | 'etransfer'
  | 'oc'
  | 'credit_card';

export type PaymentStatus = 'paid' | 'partial' | 'outstanding';
export type ServiceCode = 'OC' | 'PG' | 'FG' | 'MISC';
export type AuditAction =
  | 'insert'
  | 'update'
  | 'delete'
  | 'deactivate'
  | 'reactivate'
  | 'login'
  | 'export';

export interface Location {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** Business name printed on this location's invoices. Falls back to `name`. */
  invoice_name: string | null;
  /** Fax number printed on this location's invoices. */
  fax: string | null;
  /** HST/GST registration number printed on this location's invoices. */
  hst_number: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  full_name: string;
  role: UserRole;
  location_id: string | null;
  can_enter_expenses: boolean;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  /** NULL = use the role's default page allowlist (see lib/permissions/registry.ts). */
  allowed_pages: string[] | null;
  /** Map of pageKey -> list of columnKeys the user should NOT see. Missing pageKey = show all columns for that page. */
  hidden_columns: Record<string, string[]>;
  /** When true, this manager/staff/employee can act on rows at any location (like owner/accountant). */
  cross_location: boolean;
}

export interface ServiceType {
  id: string;
  code: ServiceCode;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface ExpenseSubcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export type CustomerStatus = 'new' | 'regular' | 'old';
export type ContactMethod = 'mail' | 'email' | 'phone' | 'sms';

export interface Customer {
  id: string;
  code: string | null;
  // legacy single field — derivable from first_name + last_or_company
  billing_name: string | null;
  // CARS-style name parts
  salutation: string | null;
  first_name: string | null;
  last_or_company: string | null;
  // billing address
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  country: string;
  postal_code: string | null;
  // mailing address (separate column; UI offers "same as billing" copy)
  mailing_address_1: string | null;
  mailing_address_2: string | null;
  mailing_city: string | null;
  mailing_province: string | null;
  mailing_country: string;
  mailing_postal_code: string | null;
  // phones
  contact_no: string | null;
  phone_home: string | null;
  phone_cell: string | null;
  phone_business: string | null;
  phone_business_ext: string | null;
  phone_fax: string | null;
  phone_alt_1: string | null;
  phone_alt_2: string | null;
  phone_notes: Record<string, string>;
  phone_search: string;
  // contact / classification
  email: string | null;
  other_contact: string | null;
  comments: string | null;
  contact_method: ContactMethod | null;
  /** 'fleet' | 'single' | null. Free-text in earlier versions; constrained by CHECK in migration 0061. */
  customer_type: "fleet" | "single" | null;
  status: CustomerStatus;
  // item #23 — carrier/customer-level card details
  card_number: string | null;
  card_expiry: string | null;
  /** WARNING: PCI-DSS prohibits CVV storage; kept by explicit client request (2026-05-22). */
  card_cvv: string | null;
  // billing options
  default_pay_method: PaymentMode | null;
  cod_required: boolean;
  labour_discount_pct: number;
  parts_discount_pct: number;
  late_payment_pct: number;
  late_payment_days: number;
  calc_interest_from: string | null;
  special_hst_rate_pct: number | null;
  pays_hst: boolean;
  // free grease
  free_grease_until: string | null;
  free_grease_overridden_at: string | null;
  free_grease_override_note: string | null;
  // item #29 — 30-day free oil-change offer (same pattern as free grease)
  free_oil_change_until: string | null;
  // legacy / context
  license_plates: string[];
  home_location_id: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  license_plate: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  engine_size: string | null;
  engine_serial: string | null;
  unit_number: string | null;
  cab_card_number: string | null;
  drive_clean_date: string | null;
  colour: string | null;
  expiry_date: string | null;
  license_renewal_date: string | null;
  follow_up_date: string | null;
  mileage: number | null;
  last_contacted_at: string | null;
  carrier_name: string | null;
  comments: string | null;
  printed_comments: string | null;
  vehicle_comments: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface VendorLocation {
  id: string;
  vendor_id: string;
  location_id: string;
  account_no: string | null;
  account_type: string | null;
  contact_no: string | null;
  email: string | null;
  sales_rep_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/** One of possibly several accounts a vendor has at a given location. */
export interface VendorLocationAccount {
  id: string;
  vendor_id: string;
  location_id: string;
  label: string | null;
  account_no: string | null;
  account_type: string | null;
  is_default: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Vendor {
  id: string;
  code: string | null;
  name: string;
  contact_no: string | null;
  email: string | null;
  account_no: string | null;
  account_type: string | null;
  category_id: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// Item #24a — vendor ↔ part many-to-many with per-vendor cost.
export interface VendorPart {
  id: string;
  vendor_id: string;
  part_id: string;
  vendor_part_number: string | null;
  cost: number;
  is_preferred: boolean;
  notes: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface VendorPartRow extends VendorPart {
  part: Pick<Part, "id" | "brand" | "part_number" | "description" | "cost" | "list_price"> | null;
  vendor: Pick<Vendor, "id" | "name" | "code"> | null;
}

// Item #24c — vendor purchase invoices.
export interface VendorInvoice {
  id: string;
  vendor_id: string;
  location_id: string;
  invoice_no: string | null;
  invoice_date: string;
  sub_total: number;
  hst: number;
  total: number;
  paid_amount: number;
  balance: number;
  payment_status: PaymentStatus;
  notes: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface VendorInvoiceItem {
  id: string;
  invoice_id: string;
  vendor_part_id: string | null;
  description: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  position: number;
  created_at: string;
}

/** Curated roster of names that appear in the Upper tech / Lower tech /
 *  Advisor dropdowns on a sales job. These are NOT login users — see
 *  migration 0065. */
export interface Technician {
  id: string;
  name: string;
  role: string | null;
  /** Home location FK. NULL = show in every location's advisor picker. */
  location_id: string | null;
  /** Joined location name (filled by the action layer where needed). */
  location_name?: string | null;
  active: boolean;
  deactivated_at: string | null;
  deactivated_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface SalesJob {
  id: string;
  location_id: string;
  job_date: string;
  bay_no: number | null;
  upper_tech: string | null;
  lower_tech: string | null;
  invoice_no: string;
  customer_id: string | null;
  billing_name: string;
  billing_address: string | null;
  business_phone: string | null;
  alt_phone: string | null;
  customer_order_no: string | null;
  unit_no: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  engine_size: string | null;
  license_plate: string | null;
  contact_no: string | null;
  email: string | null;
  odometer: number | null;
  service_type_id: string;
  carrier_name: string | null;
  // Time-of-day (HH:mm:ss) — 0054 reverted these from timestamptz back to
  // an explicit two-field model. duration_minutes is generated from the pair.
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  vehicle_id: string | null;
  advisor_name: string | null;
  free_grease_applied: boolean;
  free_grease_override_reason: string | null;
  comments: string | null;
  sub_total: number;
  hst: number;
  total: number;
  paid_amount: number;
  outstanding: number;
  payment_mode: PaymentMode | null;
  payment_status: PaymentStatus;
  engine_type_id: string | null;
  oil_type_id: string | null;
  oil_container: 'bulk' | 'gallon' | null;
  auto_priced_at: string | null;
  batch_id: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface SalesJobItem {
  id: string;
  sales_job_id: string;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  /** Per-unit Sell MHSW for the linked part, already included in unit_price.
   *  Snapshot at insert time so historical invoices stay stable. 0 for
   *  non-part / labour / package-collapsed lines. */
  mhsw_unit: number;
  /** Whether this line contributes to the HST taxable subtotal. Snapshot at
   *  insert time so historical invoices stay stable when a part's taxability
   *  is later toggled. */
  is_taxable: boolean;
  position: number;
  /** Snapshot of the package name this line was expanded from. */
  package_label: string | null;
  /** Groups all lines expanded from one package instance so they collapse to a
   *  single display line. NULL for standalone lines and pre-0068 rows. */
  package_group: string | null;
  /** Oil type this line came from (package oil item) — for overlap detection. */
  oil_type_id: string | null;
  /** Trans & Diff service this line came from — for overlap detection. */
  transmission_service_id: string | null;
  /** When set, this is a merged duplicate billed at $0; value is the waived unit price. */
  merged_unit_price: number | null;
  /** True when the customer brought the part themselves; line_total forced to 0. */
  is_customer_supplied: boolean;
  created_at: string;
  created_by: string | null;
}

export interface Expense {
  id: string;
  location_id: string;
  expense_date: string;
  category_id: string;
  subcategory_id: string | null;
  vendor_id: string | null;
  vendor_name_snapshot: string | null;
  invoice_no: string | null;
  account_type: string | null;
  account_number: string | null;
  contact_no: string | null;
  email: string | null;
  sub_total: number;
  hst: number;
  total: number;
  paid_amount: number;
  balance: number;
  payment_date: string | null;
  payment_mode: PaymentMode | null;
  transaction_id: string | null;
  payment_status: PaymentStatus;
  notes: string | null;
  batch_id: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// Item #24 — parts billed on a given expense.
export interface ExpenseItem {
  id: string;
  expense_id: string;
  part_id: string | null;
  vendor_part_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  position: number;
  /** Snapshot of the part's last buying price at the moment this row was
   *  picked from the catalog. Null when the part had no prior history or the
   *  row predates the snapshot column (0056). */
  last_buying_price_snapshot: number | null;
  created_at: string;
  created_by: string | null;
}

export interface AppSettings {
  id: 1;
  company_name: string;
  hst_rate: number;
  fiscal_year_start_month: number;
  pay_week_start: number;
  currency: string;
  invoice_format: 'manual' | 'auto';
  min_margin_alert_pct: number;
  /** Flat $ added to "With service" filter price to produce the "Over counter" sell price. */
  counter_premium: number;
  /** Flat $ charged when the customer brings their own filter — labour only. */
  customer_supplies_labour: number;
  /** Fraction of gross wages accrued as vacation pay (e.g. 0.04 = 4%). */
  vacation_pay_rate: number;
  /** WSIB premium rate applied against insurable earnings (employer only). */
  wsib_rate: number;
  /** Effective date shown on the Print List header. */
  price_list_effective_date: string | null;
  updated_at: string;
}

// ============================================================================
// Phase 2 — Payroll
// ============================================================================

export type PayrollType = 'employee' | 'management';
export type PayrollWeekStatus = 'draft' | 'approved' | 'paid';
export type StatutoryRateType =
  | 'ei_employee'
  | 'ei_employer_multiplier'
  | 'cpp_employee'
  | 'cpp2_employee';

export interface Employee {
  id: string;
  code: string | null;
  full_name: string;
  sin_last4: string | null;
  hire_date: string | null;
  termination_date: string | null;
  payroll_type: PayrollType;
  default_hourly_rate: number;
  location_id: string | null;
  profile_id: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface StatutoryRate {
  id: string;
  year: number;
  type: StatutoryRateType;
  rate: number;
  annual_max_insurable: number | null;
  annual_max_pensionable: number | null;
  annual_max_pensionable2: number | null;
  basic_exemption: number | null;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  /** When false (default) the discount line is HST-exempt (applies after tax). */
  is_taxable: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollWeek {
  id: string;
  location_id: string;
  week_start: string;
  week_end: string;
  /** 1 = weekly (Sun–Sat), 2 = bi-weekly. */
  period_weeks: number;
  status: PayrollWeekStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PayrollEntry {
  id: string;
  payroll_week_id: string;
  employee_id: string;
  hours: number;
  rate: number;
  gross_wages: number;
  // Overtime — separate so OT cost can be analysed on its own.
  overtime_hours: number;
  overtime_rate: number;
  overtime_wages: number;
  // Stat holiday + vacation accrual
  holiday_pay: number;
  vacation_pay: number;
  bonus: number;
  misc_extra: number;
  insurable_earnings: number;
  // Employee statutory deductions
  ei_employee: number;
  cpp_employee: number;
  cpp_employee2: number;
  income_tax: number;
  // Employer statutory remittances
  ei_employer: number;
  cpp_employer: number;
  cpp_employer2: number;
  wsib_employer: number;
  benefit_employee_deduction: number;
  benefit_employer_contribution: number;
  cheque_amount: number;
  cash_total: number;
  net_pay: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PayrollCashDaily {
  id: string;
  payroll_entry_id: string;
  day: string;
  amount: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface PayrollPayment {
  id: string;
  payroll_week_id: string;
  employee_id: string;
  paid_on: string;
  amount: number;
  mode: PaymentMode;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

// ============================================================================
// Phase 2 — Audit log (for UI)
// ============================================================================

export interface AuditLogRow {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  location_id: string | null;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  at: string;
}

// ============================================================================
// Phase 4 — Customer portal
// ============================================================================

export interface CustomerPortalAccess {
  id: string;
  profile_id: string;
  customer_id: string;
  created_at: string;
  created_by: string | null;
}

// ============================================================================
// Phase 4 — Recurring expenses
// ============================================================================

export type RecurringFrequency = 'monthly' | 'weekly' | 'annual';

export interface RecurringExpense {
  id: string;
  location_id: string;
  category_id: string;
  subcategory_id: string | null;
  vendor_id: string | null;
  description: string | null;
  amount: number;
  hst_rate: number;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  last_generated_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================================================
// Phase 4 — Product & Pricing
// ============================================================================

export interface OilType {
  id: string;
  code: string;
  name: string;
  is_base: boolean;
  bulk_cost_per_litre: number;
  gallon_cost_per_litre: number;
  /** Litres per gallon container for this specific oil. Imperial = 4.546,
   *  US = 3.785, metric = 4.000. */
  litres_per_gallon: number;
  /** Item #21 — gallon oil sales attract HST when true. */
  is_taxable: boolean;
  /** When true, this grade is an engine oil and shows in the Oil-change grid.
   *  Coolants / trans / diff fluids are false. */
  is_engine_oil: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type UnitOfMeasure = 'ltr' | 'gallon' | 'kg' | 'pcs' | 'hours' | 'each';

export interface EngineType {
  id: string;
  manufacturer: string;
  model: string;
  display_name: string;
  oil_capacity_litres: number;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VolumeTier {
  id: string;
  oil_type_id: string;
  min_litres: number;
  premium: number;
}

export interface ServiceCost {
  id: string;
  code: string;
  name: string;
  cost: number;
  active: boolean;
  updated_at: string;
}

export type PartMarginType = 'fixed' | 'percent';

export interface Part {
  id: string;
  part_number: string;
  brand: string;
  /** FK to part_categories. */
  category_id: string;
  /** Joined display name of the category (filled by the action layer). */
  category: string;
  /** Joined unit of measure from the category (filled by the action layer). */
  unit_of_measure: UnitOfMeasure;
  description: string | null;
  cost: number;
  list_price: number;
  /** Signed delta applied to an existing same-category line when this part is added via a package. Positive = upcharge, negative = credit. */
  extra_price: number;
  /** Sell-side MHSW — added into list_price (existing behaviour). */
  mhsw_fee: number;
  /** Buy/cost-side MHSW. Reference-only — not added to list_price or sell math (client 2026-06). */
  mhsw_buy: number;
  margin_type: PartMarginType;
  margin_value: number;
  service_cost_id: string | null;
  is_taxable: boolean;
  /** Per-part counter premium. NULL = fall back to app_settings.counter_premium. */
  counter_premium: number | null;
  /** Per-part customer-supplies labour. NULL = fall back to app_settings.customer_supplies_labour. */
  customer_supplies_labour: number | null;
  /** Per-part sell-price overrides for the "All Filter Sell Price" view. NULL = fall back to cost-up. */
  without_service_price: number | null;
  with_service_price: number | null;
  over_counter_price: number | null;
  /** When true the part is bundled in a package — Without Service price is forced to 0
   *  and a second occurrence on the same sales job defaults to over_counter_price. */
  in_package: boolean;
  /** When true, this part's unit price is rounded up to the next .99 when added to a sales job. */
  round_off: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EngineFilter {
  id: string;
  engine_type_id: string;
  part_id: string;
  quantity: number;
}

export interface PartCategory {
  id: string;
  name: string;
  unit_of_measure: UnitOfMeasure;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartBrand {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartPackage {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  /** Labor charge added on top of the package parts. Billed as its own line when expanded onto a job. */
  labor_selling_price: number;
  /** Optional description for the labor line; defaults to "Labor". */
  labor_description: string | null;
  /** When set and >= today, package uses locked_unit_price snapshots. */
  lock_until: string | null;
  /** Snapshot of labor_selling_price at lock time; null when unlocked. */
  labor_locked_selling_price: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PartPackageItem {
  id: string;
  package_id: string;
  /** When `oil_type_id` is set, this is null (item #18 link). */
  part_id: string | null;
  quantity: number;
  /** Override; null means use parts.list_price (or oil_types rate × litres) at expansion. */
  unit_price: number | null;
  /** Snapshot of effective unit_price at the moment the package was locked. */
  locked_unit_price: number | null;
  position: number;
  created_at: string;
  // Item #18 — alternative pricing source: link straight to oil_types so
  // package pricing matches the oil-change grid for oil items.
  oil_type_id: string | null;
  litres: number | null;
  oil_container: "bulk" | "gallon" | null;
  // Third pricing source: a Trans & Diff service. When set, part_id and
  // oil_type_id are null and unit_price comes from sell_price + labour.
  transmission_service_id: string | null;
}

export interface PartPackageItemRow extends PartPackageItem {
  part:
    | (Pick<
        Part,
        | "id"
        | "brand"
        | "part_number"
        | "description"
        | "list_price"
        | "extra_price"
        | "category_id"
        | "cost"
        | "mhsw_fee"
        | "category"
        | "unit_of_measure"
        | "is_taxable"
      > & {
        /** Precomputed per-part charge for a package = COST basis only
         *  (cost + Sell MHSW). NO service/labour markup — a package's labour is
         *  a single separate line (the package's own "Labor charge"). */
        package_unit_price: number;
      })
    | null;
  oil_type:
    | Pick<OilType, "id" | "code" | "name" | "bulk_cost_per_litre" | "gallon_cost_per_litre" | "litres_per_gallon" | "is_taxable">
    | null;
  /** Joined Trans & Diff service when transmission_service_id is set. */
  transmission_service:
    | {
        id: string;
        name: string;
        service_kind: string;
        is_synthetic: boolean;
        sell_price: number;
        labour: number | null;
        litres: number | null;
        oil_type_name: string | null;
      }
    | null;
}

export interface PartPackageWithItems extends PartPackage {
  items: PartPackageItemRow[];
}
