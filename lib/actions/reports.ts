"use server";

import { format, subMonths } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRowsParallel } from "@/lib/supabase/fetch-all";
import { requireProfile } from "@/lib/auth/require";
import { applyLocationFilter, resolveLocationFilter } from "@/lib/auth/locations";
import { jobTenders, tendersByMode, type PaymentRowLike } from "@/lib/utils/job-tenders";
import { payrollGross, type PayEarnings } from "@/lib/utils/payroll-math";

export interface ReportFilter {
  from?: string;
  to?: string;
  location_id?: string;
}

function defaultRange(filter: ReportFilter): { from: string; to: string; label: string } {
  const today = new Date();
  const to = filter.to ?? format(today, "yyyy-MM-dd");
  const from = filter.from ?? format(subMonths(today, 1), "yyyy-MM-dd");
  const label = `${from} → ${to}`;
  return { from, to, label };
}

// ============================================================================
// HST Summary Report
// HST collected on sales vs HST paid on expenses for the given period.
// ============================================================================
export interface HstSummary {
  period_label: string;
  hst_collected: number;
  hst_paid: number;
  net_hst_payable: number;
  sales_total: number;
  expense_total: number;
  by_month: { month: string; hst_collected: number; hst_paid: number }[];
  by_location: { location_name: string; hst_collected: number; hst_paid: number }[];
}

export async function getHstSummary(filter: ReportFilter = {}): Promise<HstSummary> {
  const profile = await requireProfile();
  if ((profile.role !== "owner" && profile.role !== "co_owner") && profile.role !== "accountant") {
    throw new Error("Unauthorized");
  }
  const supabase = await createClient();
  const { from, to, label } = defaultRange(filter);

  type SaleRow = { job_date: string; hst: number; total: number; location_id: string; locations: { name: string } | null };
  type ExpRow = { expense_date: string; hst: number; total: number; location_id: string; locations: { name: string } | null };

  // Paged: a month is ~2,300 jobs and a quarter ~6,000, and an unpaged read
  // stops at PostgREST's 1,000-row cap without an error, which under-reported
  // HST collected.
  const [sales, expenses] = await Promise.all([
    fetchAllRowsParallel<SaleRow>((lo, hi, count) => {
      let q = supabase
        .from("sales_jobs")
        .select("job_date, sub_total, hst, total, location_id, locations:location_id(name)", { count })
        .is("deactivated_at", null)
        .gte("job_date", from)
        .lte("job_date", to);
      if (filter.location_id) q = q.eq("location_id", filter.location_id);
      return q.order("id").range(lo, hi);
    }),
    fetchAllRowsParallel<ExpRow>((lo, hi, count) => {
      let q = supabase
        .from("expenses")
        .select("expense_date, sub_total, hst, total, location_id, locations:location_id(name)", { count })
        .is("deactivated_at", null)
        .gte("expense_date", from)
        .lte("expense_date", to);
      if (filter.location_id) q = q.eq("location_id", filter.location_id);
      return q.order("id").range(lo, hi);
    }),
  ]);

  const hst_collected = sales.reduce((s, r) => s + Number(r.hst), 0);
  const hst_paid = expenses.reduce((s, r) => s + Number(r.hst), 0);
  const sales_total = sales.reduce((s, r) => s + Number(r.total), 0);
  const expense_total = expenses.reduce((s, r) => s + Number(r.total), 0);

  // By month
  const monthMap: Record<string, { hst_collected: number; hst_paid: number }> = {};
  for (const r of sales) {
    const m = r.job_date.slice(0, 7);
    monthMap[m] = monthMap[m] ?? { hst_collected: 0, hst_paid: 0 };
    monthMap[m].hst_collected += Number(r.hst);
  }
  for (const r of expenses) {
    const m = r.expense_date.slice(0, 7);
    monthMap[m] = monthMap[m] ?? { hst_collected: 0, hst_paid: 0 };
    monthMap[m].hst_paid += Number(r.hst);
  }
  const by_month = Object.entries(monthMap)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // By location
  const locMap: Record<string, { hst_collected: number; hst_paid: number }> = {};
  for (const r of sales) {
    const name = r.locations?.name ?? "Unknown";
    locMap[name] = locMap[name] ?? { hst_collected: 0, hst_paid: 0 };
    locMap[name].hst_collected += Number(r.hst);
  }
  for (const r of expenses) {
    const name = r.locations?.name ?? "Unknown";
    locMap[name] = locMap[name] ?? { hst_collected: 0, hst_paid: 0 };
    locMap[name].hst_paid += Number(r.hst);
  }
  const by_location = Object.entries(locMap).map(([location_name, v]) => ({ location_name, ...v }));

  return {
    period_label: label,
    hst_collected,
    hst_paid,
    net_hst_payable: hst_collected - hst_paid,
    sales_total,
    expense_total,
    by_month,
    by_location,
  };
}

// ============================================================================
// Outstanding Invoices Report (aged receivables)
// ============================================================================
export interface OutstandingInvoice {
  id: string;
  invoice_no: string;
  job_date: string;
  billing_name: string;
  location_name: string;
  total: number;
  paid_amount: number;
  outstanding: number;
  days_overdue: number;
  bucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
}

export async function getOutstandingInvoices(filter: ReportFilter = {}): Promise<{
  rows: OutstandingInvoice[];
  total_outstanding: number;
  by_bucket: Record<string, number>;
}> {
  const profile = await requireProfile();
  const supabase = await createClient();

  let q = supabase
    .from("sales_jobs")
    .select("id, invoice_no, job_date, billing_name, total, paid_amount, outstanding, location_id, locations:location_id(name)")
    .is("deactivated_at", null)
    .in("payment_status", ["outstanding", "partial"])
    .order("job_date", { ascending: true });

  const { ids: locationIds } = resolveLocationFilter(profile, filter.location_id);
  q = applyLocationFilter(q, "location_id", locationIds);

  const { data, error } = await q;
  if (error) throw error;
  type Row = { id: string; invoice_no: string; job_date: string; billing_name: string; total: number; paid_amount: number; outstanding: number; location_id: string; locations: { name: string } | null };
  const raw = (data ?? []) as unknown as Row[];

  const today = Date.now();
  const rows: OutstandingInvoice[] = raw.map((r) => {
    const days = Math.floor((today - new Date(r.job_date).getTime()) / 86400_000);
    let bucket: OutstandingInvoice["bucket"] = "current";
    if (days > 90) bucket = "90+";
    else if (days > 60) bucket = "61-90";
    else if (days > 30) bucket = "31-60";
    else if (days > 0) bucket = "1-30";
    return {
      id: r.id,
      invoice_no: r.invoice_no,
      job_date: r.job_date,
      billing_name: r.billing_name,
      location_name: r.locations?.name ?? "Unknown",
      total: Number(r.total),
      paid_amount: Number(r.paid_amount),
      outstanding: Number(r.outstanding),
      days_overdue: days,
      bucket,
    };
  });

  const by_bucket: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of rows) by_bucket[r.bucket] += r.outstanding;
  const total_outstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return { rows, total_outstanding, by_bucket };
}

// ============================================================================
// P&L Report
// Sales - Expenses - Payroll = Net
// ============================================================================
export interface PnlReport {
  period_label: string;
  sales_total: number;
  expense_total: number;
  payroll_total: number;
  net_profit: number;
  by_location: { name: string; sales: number; expenses: number; payroll: number; net: number }[];
  by_month: { month: string; sales: number; expenses: number; payroll: number; net: number }[];
}

export async function getPnlReport(filter: ReportFilter = {}): Promise<PnlReport> {
  const profile = await requireProfile();
  if (profile.role === "staff" || profile.role === "employee") {
    throw new Error("Unauthorized");
  }
  const supabase = await createClient();
  const { from, to, label } = defaultRange(filter);
  const { ids: locationIds } = resolveLocationFilter(profile, filter.location_id);

  type SRow = { job_date: string; total: number; location_id: string; locations: { name: string } | null };
  type ERow = { expense_date: string; total: number; location_id: string; locations: { name: string } | null };
  type PRow = PayEarnings & { benefit_employer_contribution: number; payroll_weeks: { week_start: string; location_id: string; locations: { name: string } | null } };
  // Gross pay as the pay stub shows it (regular + OT + holiday + extras) plus
  // the employer's benefit share. gross_wages alone is hours × rate only.
  const payrollCost = (r: PRow) => payrollGross(r) + Number(r.benefit_employer_contribution);

  // Paged past the 1,000-row cap, as in getHstSummary.
  const [sales, expenses, payroll] = await Promise.all([
    fetchAllRowsParallel<SRow>((lo, hi, count) => {
      let q = supabase
        .from("sales_jobs")
        .select("job_date, total, location_id, locations:location_id(name)", { count })
        .is("deactivated_at", null)
        .gte("job_date", from)
        .lte("job_date", to);
      q = applyLocationFilter(q, "location_id", locationIds);
      return q.order("id").range(lo, hi);
    }),
    fetchAllRowsParallel<ERow>((lo, hi, count) => {
      let q = supabase
        .from("expenses")
        .select("expense_date, total, location_id, locations:location_id(name)", { count })
        .is("deactivated_at", null)
        .gte("expense_date", from)
        .lte("expense_date", to);
      q = applyLocationFilter(q, "location_id", locationIds);
      return q.order("id").range(lo, hi);
    }),
    fetchAllRowsParallel<PRow>((lo, hi, count) => {
      let q = supabase
        .from("payroll_entries")
        // "*": phone_allowance (0158) can't be named until that migration runs.
        .select("*, payroll_weeks!inner(week_start, location_id, locations:location_id(name))", { count })
        .gte("payroll_weeks.week_start", from)
        .lte("payroll_weeks.week_start", to);
      q = applyLocationFilter(q, "payroll_weeks.location_id", locationIds);
      return q.order("id").range(lo, hi);
    }),
  ]);

  const sales_total = sales.reduce((s, r) => s + Number(r.total), 0);
  const expense_total = expenses.reduce((s, r) => s + Number(r.total), 0);
  const payroll_total = payroll.reduce((s, r) => s + payrollCost(r), 0);

  // By location
  const locMap: Record<string, { sales: number; expenses: number; payroll: number }> = {};
  for (const r of sales) {
    const name = r.locations?.name ?? "Unknown";
    locMap[name] = locMap[name] ?? { sales: 0, expenses: 0, payroll: 0 };
    locMap[name].sales += Number(r.total);
  }
  for (const r of expenses) {
    const name = r.locations?.name ?? "Unknown";
    locMap[name] = locMap[name] ?? { sales: 0, expenses: 0, payroll: 0 };
    locMap[name].expenses += Number(r.total);
  }
  for (const r of payroll) {
    const name = r.payroll_weeks.locations?.name ?? "Unknown";
    locMap[name] = locMap[name] ?? { sales: 0, expenses: 0, payroll: 0 };
    locMap[name].payroll += payrollCost(r);
  }
  const by_location = Object.entries(locMap).map(([name, v]) => ({
    name,
    sales: v.sales,
    expenses: v.expenses,
    payroll: v.payroll,
    net: v.sales - v.expenses - v.payroll,
  }));

  // By month
  const monthMap: Record<string, { sales: number; expenses: number; payroll: number }> = {};
  for (const r of sales) {
    const m = r.job_date.slice(0, 7);
    monthMap[m] = monthMap[m] ?? { sales: 0, expenses: 0, payroll: 0 };
    monthMap[m].sales += Number(r.total);
  }
  for (const r of expenses) {
    const m = r.expense_date.slice(0, 7);
    monthMap[m] = monthMap[m] ?? { sales: 0, expenses: 0, payroll: 0 };
    monthMap[m].expenses += Number(r.total);
  }
  for (const r of payroll) {
    const m = r.payroll_weeks.week_start.slice(0, 7);
    monthMap[m] = monthMap[m] ?? { sales: 0, expenses: 0, payroll: 0 };
    monthMap[m].payroll += payrollCost(r);
  }
  const by_month = Object.entries(monthMap)
    .map(([month, v]) => ({
      month,
      sales: v.sales,
      expenses: v.expenses,
      payroll: v.payroll,
      net: v.sales - v.expenses - v.payroll,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    period_label: label,
    sales_total,
    expense_total,
    payroll_total,
    net_profit: sales_total - expense_total - payroll_total,
    by_location,
    by_month,
  };
}

// ============================================================================
// Customer statement
// ============================================================================
export interface CustomerStatement {
  customer_name: string;
  period_label: string;
  rows: {
    id: string;
    job_date: string;
    invoice_no: string;
    total: number;
    paid_amount: number;
    outstanding: number;
    payment_status: string;
  }[];
  total_billed: number;
  total_paid: number;
  total_outstanding: number;
}

export async function getCustomerStatement(
  customerId: string,
  filter: ReportFilter = {},
): Promise<CustomerStatement | null> {
  await requireProfile();
  const supabase = await createClient();
  const { from, to, label } = defaultRange({ ...filter, from: filter.from ?? "2000-01-01" });

  const { data: cust } = await supabase
    .from("customers")
    .select("billing_name")
    .eq("id", customerId)
    .single();
  if (!cust) return null;

  type R = { id: string; job_date: string; invoice_no: string; total: number; paid_amount: number; outstanding: number; payment_status: string };
  // All-time by default, so a fleet account can pass the 1,000-row cap.
  const data = await fetchAllRowsParallel<R>((lo, hi, count) =>
    supabase
      .from("sales_jobs")
      .select("id, job_date, invoice_no, total, paid_amount, outstanding, payment_status", { count })
      .eq("customer_id", customerId)
      .is("deactivated_at", null)
      .gte("job_date", from)
      .lte("job_date", to)
      .order("job_date")
      .order("id")
      .range(lo, hi),
  );
  const rows = data.map((r) => ({
    ...r,
    total: Number(r.total),
    paid_amount: Number(r.paid_amount),
    outstanding: Number(r.outstanding),
  }));

  return {
    customer_name: (cust as { billing_name: string }).billing_name,
    period_label: label,
    rows,
    total_billed: rows.reduce((s, r) => s + r.total, 0),
    total_paid: rows.reduce((s, r) => s + r.paid_amount, 0),
    total_outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
  };
}

// ============================================================================
// Vendor statement
// ============================================================================
export interface VendorStatement {
  vendor_name: string;
  period_label: string;
  rows: {
    id: string;
    expense_date: string;
    invoice_no: string | null;
    total: number;
    paid_amount: number;
    balance: number;
    payment_status: string;
  }[];
  total_billed: number;
  total_paid: number;
  total_outstanding: number;
}

export async function getVendorStatement(
  vendorId: string,
  filter: ReportFilter = {},
): Promise<VendorStatement | null> {
  await requireProfile();
  const supabase = await createClient();
  const { from, to, label } = defaultRange({ ...filter, from: filter.from ?? "2000-01-01" });

  const { data: vend } = await supabase
    .from("vendors")
    .select("name")
    .eq("id", vendorId)
    .single();
  if (!vend) return null;

  type R = { id: string; expense_date: string; invoice_no: string | null; total: number; paid_amount: number; balance: number; payment_status: string };
  const data = await fetchAllRowsParallel<R>((lo, hi, count) =>
    supabase
      .from("expenses")
      .select("id, expense_date, invoice_no, total, paid_amount, balance, payment_status", { count })
      .eq("vendor_id", vendorId)
      .is("deactivated_at", null)
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date")
      .order("id")
      .range(lo, hi),
  );
  const rows = data.map((r) => ({
    ...r,
    total: Number(r.total),
    paid_amount: Number(r.paid_amount),
    balance: Number(r.balance),
  }));

  return {
    vendor_name: (vend as { name: string }).name,
    period_label: label,
    rows,
    total_billed: rows.reduce((s, r) => s + r.total, 0),
    total_paid: rows.reduce((s, r) => s + r.paid_amount, 0),
    total_outstanding: rows.reduce((s, r) => s + r.balance, 0),
  };
}

// ============================================================================
// Daily Job Report (item #11)
// One-day snapshot for a single date and (optionally) a single location.
// Returns: per-job rows, aggregated parts list, service-type breakdown,
// per-hour totals (using start_time), and customer-status mix — plus the
// whole day's money (client 2026-10-20): every job's payment methods, the
// payments received that day on any invoice (the cash drawer), and a
// per-method summary of both.
// ============================================================================
export interface DailyJobReportRow {
  id: string;
  invoice_no: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  service_code: string | null;
  service_name: string | null;
  location_code: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_status: string | null;
  vehicle_id: string | null;
  plate: string | null;
  vehicle_label: string | null;
  unit_no: string | null;
  odometer: number | null;
  upper_tech: string | null;
  lower_tech: string | null;
  advisor_name: string | null;
  sub_total: number;
  hst: number;
  total: number;
  paid_amount: number;
  credit_applied: number;
  outstanding: number;
  payment_status: string;
  /** Tenders on this invoice (any date), summed per method. */
  payments: { mode: string | null; amount: number }[];
}

export interface DailyJobReportPart {
  part_id: string | null;
  part_number: string | null;
  brand: string | null;
  description: string;
  qty_total: number;
  revenue: number;
}

/** A payment taken on the report date, on any invoice. */
export interface DailyPaymentReceived {
  key: string;
  paid_on: string;
  /** When it was entered — the time of day for the drawer. */
  created_at: string | null;
  amount: number;
  mode: string | null;
  reference: string | null;
  notes: string | null;
  job_id: string;
  invoice_no: string;
  job_date: string;
  /** Paid today on an invoice from an earlier day. */
  older_invoice: boolean;
  customer_id: string | null;
  customer_name: string | null;
  location_code: string | null;
  /** Settled on a legacy job with no payment ledger rows. */
  legacy: boolean;
}

export interface DailyPaymentMethodRow {
  mode: string | null;
  /** The day's jobs paid (partly) this way, and how much, whenever paid. */
  jobs_count: number;
  jobs_amount: number;
  /** Payments taken this way on the report date, on any invoice. */
  received_count: number;
  received_amount: number;
}

export interface DailyJobReport {
  date: string;
  location_id: string | null;
  totals: {
    job_count: number;
    sub_total: number;
    hst: number;
    total: number;
    paid: number;
    credit_applied: number;
    /** Still owed by customers: each job floored at 0. */
    outstanding: number;
    /** Owed back to customers on today's returns (negative balances). */
    refunds_due: number;
    received: number;
    received_count: number;
    /** Part of `received` paid on invoices from earlier days. */
    received_older: number;
  };
  jobs: DailyJobReportRow[];
  parts_used: DailyJobReportPart[];
  by_service: Array<{ code: string; name: string; count: number; revenue: number }>;
  by_hour: Array<{ hour: number; count: number; revenue: number }>;
  by_customer_status: Array<{ status: string; count: number }>;
  by_payment_method: DailyPaymentMethodRow[];
  payments_received: DailyPaymentReceived[];
}

export async function getDailyJobReport(
  date: string,
  locationId: string | null = null,
): Promise<DailyJobReport> {
  const profile = await requireProfile();
  const supabase = await createClient();
  // The caller passes what the user picked in the filter; clamp it to the
  // locations they're actually allowed to see (migration 0137).
  const { ids: locationIds } = resolveLocationFilter(profile, locationId);

  let query = supabase
    .from("sales_jobs")
    .select(
      `id, invoice_no, start_time, end_time, duration_minutes, total, paid_amount, outstanding,
       payment_status, sub_total, hst, credit_applied, payment_mode, job_date, advisor_name,
       upper_tech, lower_tech, customer_id, vehicle_id, odometer, unit_no,
       license_plate, billing_name,
       locations:location_id(code),
       service_types:service_type_id(code, name),
       customers:customer_id(status, billing_name, last_or_company),
       vehicles:vehicle_id(license_plate, year, make, model, carrier_name),
       sales_payments(id, paid_on, amount, mode, transaction_id, notes, created_at)`,
    )
    .is("deactivated_at", null)
    .eq("job_date", date)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("invoice_no");
  query = applyLocationFilter(query, "location_id", locationIds);

  // Payments dated today on ANY invoice — the cash drawer. Scoped to the
  // location through the invoice. Paged: a busy day is ~150, but nothing
  // stops a bulk entry of back payments.
  type ReceivedRow = {
    id: string;
    paid_on: string;
    amount: number;
    mode: string;
    transaction_id: string | null;
    notes: string | null;
    created_at: string | null;
    sales_jobs: {
      id: string;
      invoice_no: string;
      job_date: string;
      customer_id: string | null;
      billing_name: string | null;
      locations: { code: string | null } | null;
      customers: { billing_name: string | null; last_or_company: string | null } | null;
    };
  };
  const receivedPromise = fetchAllRowsParallel<ReceivedRow>((lo, hi, count) => {
    let q = supabase
      .from("sales_payments")
      .select(
        `id, paid_on, amount, mode, transaction_id, notes, created_at,
         sales_jobs!inner(id, invoice_no, job_date, customer_id, billing_name, location_id,
           locations:location_id(code),
           customers:customer_id(billing_name, last_or_company))`,
        { count },
      )
      .eq("paid_on", date)
      .is("sales_jobs.deactivated_at", null);
    q = applyLocationFilter(q, "sales_jobs.location_id", locationIds);
    return q.order("id").range(lo, hi);
  });

  const [{ data: jobsData, error: jobsErr }, receivedRows] = await Promise.all([
    query,
    receivedPromise,
  ]);
  if (jobsErr) throw jobsErr;

  type Joined = {
    id: string;
    invoice_no: string;
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number | null;
    total: number;
    paid_amount: number;
    outstanding: number;
    payment_status: string;
    sub_total: number;
    hst: number;
    credit_applied: number | null;
    payment_mode: string | null;
    job_date: string;
    advisor_name: string | null;
    upper_tech: string | null;
    lower_tech: string | null;
    customer_id: string | null;
    vehicle_id: string | null;
    odometer: number | null;
    unit_no: string | null;
    license_plate: string | null;
    billing_name: string | null;
    locations: { code: string | null } | { code: string | null }[] | null;
    service_types:
      | { code: string | null; name: string | null }
      | { code: string | null; name: string | null }[]
      | null;
    customers:
      | {
          status: string | null;
          billing_name: string | null;
          last_or_company: string | null;
        }
      | {
          status: string | null;
          billing_name: string | null;
          last_or_company: string | null;
        }[]
      | null;
    vehicles:
      | {
          license_plate: string | null;
          year: number | null;
          make: string | null;
          model: string | null;
          carrier_name: string | null;
        }
      | {
          license_plate: string | null;
          year: number | null;
          make: string | null;
          model: string | null;
          carrier_name: string | null;
        }[]
      | null;
    sales_payments: PaymentRowLike[] | null;
  };
  const rows = (jobsData ?? []) as unknown as Joined[];
  const jobIds = rows.map((r) => r.id);

  // Aggregated parts list (only if any jobs)
  let parts: DailyJobReportPart[] = [];
  if (jobIds.length > 0) {
    // ~8 lines a job, so a busy day across three shops nears the 1,000-row cap.
    const items = await fetchAllRowsParallel<unknown>((lo, hi, count) =>
      supabase
        .from("sales_job_items")
        // `*` so auto_fee (0149) is read when present without breaking before it.
        .select("*, parts:part_id(part_number, brand)", { count })
        .in("sales_job_id", jobIds)
        .order("id")
        .range(lo, hi),
    );
    type Item = {
      part_id: string | null;
      description: string;
      quantity: number;
      line_total: number;
      auto_fee?: "oil_tier_premium" | "grease_only_fee" | null;
      parts:
        | { part_number: string | null; brand: string | null }
        | { part_number: string | null; brand: string | null }[]
        | null;
    };
    const map = new Map<string, DailyJobReportPart>();
    for (const row of items as Item[]) {
      let it = row;
      const partRel = Array.isArray(it.parts) ? it.parts[0] : it.parts;
      // Automatic charges carry a per-job description ("Volume tier premium —
      // Delo … 34 L"), so group them by kind rather than one row per job.
      const autoLabel =
        it.auto_fee === "oil_tier_premium"
          ? "Volume tier premium"
          : it.auto_fee === "grease_only_fee"
            ? "Grease-only service fee"
            : null;
      if (autoLabel) it = { ...it, description: autoLabel };
      const key = it.part_id ?? (autoLabel ? `auto:${it.auto_fee}` : `desc:${it.description}`);
      const existing = map.get(key);
      if (existing) {
        existing.qty_total += Number(it.quantity);
        existing.revenue += Number(it.line_total);
      } else {
        map.set(key, {
          part_id: it.part_id,
          part_number: partRel?.part_number ?? null,
          brand: partRel?.brand ?? null,
          description: it.description,
          qty_total: Number(it.quantity),
          revenue: Number(it.line_total),
        });
      }
    }
    parts = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }

  function pickRel<T>(rel: T | T[] | null | undefined): T | null {
    if (!rel) return null;
    if (Array.isArray(rel)) return rel[0] ?? null;
    return rel;
  }

  function customerName(c: Joined["customers"]): string | null {
    const cc = pickRel(c);
    if (!cc) return null;
    return cc.billing_name ?? cc.last_or_company ?? null;
  }

  function vehicleLabel(j: Joined): string | null {
    const v = pickRel(j.vehicles);
    if (v && v.license_plate) {
      const trim = [v.year, v.make, v.model].filter(Boolean).join(" ");
      return trim ? `${v.license_plate} · ${trim}` : v.license_plate;
    }
    return j.license_plate;
  }

  function hourFromTime(t: string | null): number | null {
    if (!t) return null;
    const m = /^(\d{2}):/.exec(t);
    return m ? Number(m[1]) : null;
  }

  // Each job's tenders, with the legacy fallback (paid_amount, no ledger rows).
  const tendersByJob = new Map(rows.map((r) => [r.id, jobTenders(r, r.sales_payments)]));

  const jobs: DailyJobReportRow[] = rows.map((r) => {
    const loc = pickRel(r.locations);
    const svc = pickRel(r.service_types);
    return {
      id: r.id,
      invoice_no: r.invoice_no,
      start_time: r.start_time,
      end_time: r.end_time,
      duration_minutes: r.duration_minutes,
      service_code: svc?.code ?? null,
      service_name: svc?.name ?? null,
      location_code: loc?.code ?? null,
      customer_id: r.customer_id,
      customer_name: customerName(r.customers) ?? r.billing_name,
      customer_status: pickRel(r.customers)?.status ?? null,
      vehicle_id: r.vehicle_id,
      plate: pickRel(r.vehicles)?.license_plate ?? r.license_plate,
      vehicle_label: vehicleLabel(r),
      unit_no: r.unit_no,
      odometer: r.odometer,
      upper_tech: r.upper_tech,
      lower_tech: r.lower_tech,
      advisor_name: r.advisor_name,
      sub_total: Number(r.sub_total ?? 0),
      hst: Number(r.hst ?? 0),
      total: Number(r.total ?? 0),
      paid_amount: Number(r.paid_amount ?? 0),
      credit_applied: Number(r.credit_applied ?? 0),
      outstanding: Number(r.outstanding ?? 0),
      payment_status: r.payment_status,
      payments: tendersByMode(tendersByJob.get(r.id) ?? []),
    };
  });

  // Payments received today: the ledger rows, plus legacy jobs dated today
  // (their paid_amount counts as paid on the job date).
  const payments_received: DailyPaymentReceived[] = receivedRows.map((p) => {
    const job = p.sales_jobs;
    return {
      key: p.id,
      paid_on: p.paid_on,
      created_at: p.created_at,
      amount: Number(p.amount),
      mode: p.mode,
      reference: p.transaction_id,
      notes: p.notes,
      job_id: job.id,
      invoice_no: job.invoice_no,
      job_date: job.job_date,
      older_invoice: job.job_date < date,
      customer_id: job.customer_id,
      customer_name: job.customers?.billing_name ?? job.customers?.last_or_company ?? job.billing_name,
      location_code: job.locations?.code ?? null,
      legacy: false,
    };
  });
  for (const j of jobs) {
    for (const t of tendersByJob.get(j.id) ?? []) {
      if (!t.legacy || t.paid_on !== date) continue;
      payments_received.push({
        key: `legacy-${j.id}`,
        paid_on: t.paid_on,
        created_at: null,
        amount: t.amount,
        mode: t.mode,
        reference: null,
        notes: null,
        job_id: j.id,
        invoice_no: j.invoice_no,
        job_date: date,
        older_invoice: false,
        customer_id: j.customer_id,
        customer_name: j.customer_name,
        location_code: j.location_code,
        legacy: true,
      });
    }
  }
  payments_received.sort(
    (a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.invoice_no.localeCompare(b.invoice_no),
  );

  // By payment method: how the day's invoices were paid, and what came in today.
  const methodMap = new Map<string | null, DailyPaymentMethodRow>();
  const method = (mode: string | null) => {
    let row = methodMap.get(mode);
    if (!row) {
      row = { mode, jobs_count: 0, jobs_amount: 0, received_count: 0, received_amount: 0 };
      methodMap.set(mode, row);
    }
    return row;
  };
  for (const j of jobs) {
    for (const p of j.payments) {
      const row = method(p.mode);
      row.jobs_count += 1;
      row.jobs_amount += p.amount;
    }
  }
  for (const p of payments_received) {
    const row = method(p.mode);
    row.received_count += 1;
    row.received_amount += p.amount;
  }
  const by_payment_method = Array.from(methodMap.values()).sort(
    (a, b) => b.received_amount + b.jobs_amount - (a.received_amount + a.jobs_amount),
  );

  const totals = {
    job_count: rows.length,
    sub_total: rows.reduce((s, r) => s + Number(r.sub_total ?? 0), 0),
    hst: rows.reduce((s, r) => s + Number(r.hst ?? 0), 0),
    total: rows.reduce((s, r) => s + Number(r.total ?? 0), 0),
    paid: rows.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0),
    credit_applied: rows.reduce((s, r) => s + Number(r.credit_applied ?? 0), 0),
    // Owed by customers: each job floored at 0, as in the jobs table. A
    // return's negative balance is money back to the customer, not less owing
    // on the day's other jobs — it is shown on its own.
    outstanding: rows.reduce((s, r) => s + Math.max(0, Number(r.outstanding ?? 0)), 0),
    refunds_due: rows.reduce((s, r) => s + Math.max(0, -Number(r.outstanding ?? 0)), 0),
    received: payments_received.reduce((s, p) => s + p.amount, 0),
    received_count: payments_received.length,
    received_older: payments_received.reduce((s, p) => s + (p.older_invoice ? p.amount : 0), 0),
  };

  // by_service
  const svcMap = new Map<string, { code: string; name: string; count: number; revenue: number }>();
  for (const j of jobs) {
    const code = j.service_code ?? "—";
    const name = j.service_name ?? "—";
    const k = code;
    const existing = svcMap.get(k);
    if (existing) {
      existing.count += 1;
      existing.revenue += j.total;
    } else {
      svcMap.set(k, { code, name, count: 1, revenue: j.total });
    }
  }
  const by_service = Array.from(svcMap.values()).sort((a, b) => b.revenue - a.revenue);

  // by_hour (0-23). Skip jobs with no usable time.
  const hourBuckets = new Map<number, { count: number; revenue: number }>();
  for (const r of rows) {
    const h = hourFromTime(r.start_time);
    if (h == null) continue;
    const existing = hourBuckets.get(h);
    const total = Number(r.total ?? 0);
    if (existing) {
      existing.count += 1;
      existing.revenue += total;
    } else {
      hourBuckets.set(h, { count: 1, revenue: total });
    }
  }
  const by_hour = Array.from(hourBuckets.entries())
    .map(([hour, v]) => ({ hour, ...v }))
    .sort((a, b) => a.hour - b.hour);

  // by_customer_status
  const statusMap = new Map<string, number>();
  for (const j of jobs) {
    const s = j.customer_status ?? "unknown";
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }
  const by_customer_status = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  return {
    date,
    location_id: locationId,
    totals,
    jobs,
    parts_used: parts,
    by_service,
    by_hour,
    by_customer_status,
    by_payment_method,
    payments_received,
  };
}
