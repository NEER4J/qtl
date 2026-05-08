// Hand-rolled placeholder. Replace with:
//   supabase gen types typescript --local > lib/db/types.ts
// once `supabase start` has applied the migrations.

export type UserRole = 'owner' | 'manager' | 'accountant' | 'staff' | 'employee' | 'portal_customer';

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
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  location_id: string | null;
  can_enter_expenses: boolean;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
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
  // address
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  country: string;
  postal_code: string | null;
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
  customer_type: string | null;
  status: CustomerStatus;
  // item #23 — carrier/customer-level card number
  card_number: string | null;
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
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  // New fields (0037): single time, advisor, vehicle link, free-grease.
  vehicle_id: string | null;
  job_time: string | null;
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
  /** Whether this line contributes to the HST taxable subtotal. Snapshot at
   *  insert time so historical invoices stay stable when a part's taxability
   *  is later toggled. */
  is_taxable: boolean;
  position: number;
  /** Snapshot of the package name this line was expanded from. */
  package_label: string | null;
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

export interface PayrollWeek {
  id: string;
  location_id: string;
  week_start: string;
  week_end: string;
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
  bonus: number;
  misc_extra: number;
  insurable_earnings: number;
  ei_employee: number;
  cpp_employee: number;
  income_tax: number;
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
  sort_order: number;
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
  mhsw_fee: number;
  margin_type: PartMarginType;
  margin_value: number;
  service_cost_id: string | null;
  is_taxable: boolean;
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
}

export interface PartPackageItemRow extends PartPackageItem {
  part:
    | Pick<
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
      >
    | null;
  oil_type:
    | Pick<OilType, "id" | "code" | "name" | "bulk_cost_per_litre" | "gallon_cost_per_litre" | "litres_per_gallon" | "is_taxable">
    | null;
}

export interface PartPackageWithItems extends PartPackage {
  items: PartPackageItemRow[];
}
