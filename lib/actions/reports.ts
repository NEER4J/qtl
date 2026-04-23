"use server";

import { format, subMonths } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/require";

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
  if (profile.role !== "owner" && profile.role !== "accountant") {
    throw new Error("Unauthorized");
  }
  const supabase = await createClient();
  const { from, to, label } = defaultRange(filter);

  let salesQ = supabase
    .from("sales_jobs")
    .select("job_date, sub_total, hst, total, location_id, locations:location_id(name)")
    .is("deactivated_at", null)
    .gte("job_date", from)
    .lte("job_date", to);
  if (filter.location_id) salesQ = salesQ.eq("location_id", filter.location_id);
  const { data: salesData, error: salesErr } = await salesQ;
  if (salesErr) throw salesErr;

  let expQ = supabase
    .from("expenses")
    .select("expense_date, sub_total, hst, total, location_id, locations:location_id(name)")
    .is("deactivated_at", null)
    .gte("expense_date", from)
    .lte("expense_date", to);
  if (filter.location_id) expQ = expQ.eq("location_id", filter.location_id);
  const { data: expData, error: expErr } = await expQ;
  if (expErr) throw expErr;

  type SaleRow = { job_date: string; hst: number; total: number; location_id: string; locations: { name: string } | null };
  type ExpRow = { expense_date: string; hst: number; total: number; location_id: string; locations: { name: string } | null };
  const sales = (salesData ?? []) as unknown as SaleRow[];
  const expenses = (expData ?? []) as unknown as ExpRow[];

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

  const locationId = filter.location_id
    ?? (profile.role === "manager" ? profile.location_id ?? undefined : undefined);
  if (locationId) q = q.eq("location_id", locationId);

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
  const locationId = filter.location_id
    ?? (profile.role === "manager" ? profile.location_id ?? undefined : undefined);

  let salesQ = supabase
    .from("sales_jobs")
    .select("job_date, total, location_id, locations:location_id(name)")
    .is("deactivated_at", null)
    .gte("job_date", from)
    .lte("job_date", to);
  if (locationId) salesQ = salesQ.eq("location_id", locationId);

  let expQ = supabase
    .from("expenses")
    .select("expense_date, total, location_id, locations:location_id(name)")
    .is("deactivated_at", null)
    .gte("expense_date", from)
    .lte("expense_date", to);
  if (locationId) expQ = expQ.eq("location_id", locationId);

  let payQ = supabase
    .from("payroll_entries")
    .select("gross_wages, bonus, misc_extra, benefit_employer_contribution, payroll_weeks!inner(week_start, location_id, locations:location_id(name))")
    .gte("payroll_weeks.week_start", from)
    .lte("payroll_weeks.week_start", to);
  if (locationId) payQ = payQ.eq("payroll_weeks.location_id", locationId);

  const [salesR, expR, payR] = await Promise.all([salesQ, expQ, payQ]);
  if (salesR.error) throw salesR.error;
  if (expR.error) throw expR.error;
  if (payR.error) throw payR.error;

  type SRow = { job_date: string; total: number; location_id: string; locations: { name: string } | null };
  type ERow = { expense_date: string; total: number; location_id: string; locations: { name: string } | null };
  type PRow = { gross_wages: number; bonus: number; misc_extra: number; benefit_employer_contribution: number; payroll_weeks: { week_start: string; location_id: string; locations: { name: string } | null } };

  const sales = (salesR.data ?? []) as unknown as SRow[];
  const expenses = (expR.data ?? []) as unknown as ERow[];
  const payroll = (payR.data ?? []) as unknown as PRow[];

  const sales_total = sales.reduce((s, r) => s + Number(r.total), 0);
  const expense_total = expenses.reduce((s, r) => s + Number(r.total), 0);
  const payroll_total = payroll.reduce((s, r) => s + Number(r.gross_wages) + Number(r.bonus) + Number(r.misc_extra) + Number(r.benefit_employer_contribution), 0);

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
    locMap[name].payroll += Number(r.gross_wages) + Number(r.bonus) + Number(r.misc_extra) + Number(r.benefit_employer_contribution);
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
    monthMap[m].payroll += Number(r.gross_wages) + Number(r.bonus) + Number(r.misc_extra) + Number(r.benefit_employer_contribution);
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

  const { data, error } = await supabase
    .from("sales_jobs")
    .select("id, job_date, invoice_no, total, paid_amount, outstanding, payment_status")
    .eq("customer_id", customerId)
    .is("deactivated_at", null)
    .gte("job_date", from)
    .lte("job_date", to)
    .order("job_date");
  if (error) throw error;

  type R = { id: string; job_date: string; invoice_no: string; total: number; paid_amount: number; outstanding: number; payment_status: string };
  const rows = ((data ?? []) as R[]).map((r) => ({
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

  const { data, error } = await supabase
    .from("expenses")
    .select("id, expense_date, invoice_no, total, paid_amount, balance, payment_status")
    .eq("vendor_id", vendorId)
    .is("deactivated_at", null)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date");
  if (error) throw error;

  type R = { id: string; expense_date: string; invoice_no: string | null; total: number; paid_amount: number; balance: number; payment_status: string };
  const rows = ((data ?? []) as R[]).map((r) => ({
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
