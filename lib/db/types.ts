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

export interface Customer {
  id: string;
  code: string | null;
  billing_name: string;
  contact_no: string | null;
  email: string | null;
  license_plates: string[];
  home_location_id: string | null;
  notes: string | null;
  active: boolean;
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
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PartPackageItem {
  id: string;
  package_id: string;
  part_id: string;
  quantity: number;
  /** Override; null means use parts.list_price at expansion. */
  unit_price: number | null;
  position: number;
  created_at: string;
}

export interface PartPackageItemRow extends PartPackageItem {
  part: Pick<
    Part,
    | "id"
    | "brand"
    | "part_number"
    | "description"
    | "list_price"
    | "category"
    | "unit_of_measure"
    | "is_taxable"
  >;
}

export interface PartPackageWithItems extends PartPackage {
  items: PartPackageItemRow[];
}
