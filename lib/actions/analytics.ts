"use server";

import { format, parseISO, startOfMonth, subDays } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/require";

// ============================================================================
// Shared filter shape
// ============================================================================
export interface AnalyticsFilter {
  from?: string;          // yyyy-MM-dd
  to?: string;            // yyyy-MM-dd
  location_id?: string;
  service_type_id?: string;
  payment_mode?: string;
  category_id?: string;
  vendor_id?: string;
  employee_id?: string;
  bay_no?: string;
}

function defaultRange(filter: AnalyticsFilter): { from: string; to: string; label: string } {
  const today = new Date();
  const from = filter.from ?? format(subDays(today, 29), "yyyy-MM-dd");
  const to = filter.to ?? format(today, "yyyy-MM-dd");
  const label = `${from} → ${to}`;
  return { from, to, label };
}

async function scopedClient(filter: AnalyticsFilter) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const locationId =
    filter.location_id
    ?? (profile.role === "manager" ? profile.location_id ?? undefined : undefined);
  return { supabase, profile, locationId };
}

// ============================================================================
// Sales analytics
// ============================================================================
export interface SalesAnalytics {
  period_label: string;
  total_revenue: number;
  total_jobs: number;
  avg_job_value: number;
  outstanding: number;
  daily_trend: { day: string; total: number; count: number }[];
  by_location: { location_code: string; location_name: string; total: number; count: number }[];
  by_payment_mode: { mode: string; total: number }[];
  outstanding_vs_collected: { month: string; outstanding: number; collected: number }[];
  top_customers: { billing_name: string; total: number; count: number }[];
}

export async function getSalesAnalytics(filter: AnalyticsFilter = {}): Promise<SalesAnalytics> {
  const { supabase, locationId } = await scopedClient(filter);
  const { from, to, label } = defaultRange(filter);

  let q = supabase
    .from("sales_jobs")
    .select("id, job_date, billing_name, location_id, total, outstanding, payment_mode, service_type_id, locations:location_id(code, name)")
    .is("deactivated_at", null)
    .gte("job_date", from)
    .lte("job_date", to)
    .order("job_date");
  if (locationId) q = q.eq("location_id", locationId);
  if (filter.service_type_id) q = q.eq("service_type_id", filter.service_type_id);
  if (filter.payment_mode) q = q.eq("payment_mode", filter.payment_mode);

  const { data, error } = await q;
  if (error) throw error;
  type Row = { id: string; job_date: string; billing_name: string; location_id: string; total: number; outstanding: number; payment_mode: string | null; service_type_id: string; locations: { code: string; name: string } | null };
  const rows = (data ?? []) as unknown as Row[];

  const total_revenue = rows.reduce((s, r) => s + Number(r.total), 0);
  const total_jobs = rows.length;
  const avg_job_value = total_jobs > 0 ? total_revenue / total_jobs : 0;
  const outstanding = rows.reduce((s, r) => s + Number(r.outstanding), 0);

  // Daily trend
  const dailyMap: Record<string, { total: number; count: number }> = {};
  for (const r of rows) {
    const d = r.job_date;
    dailyMap[d] = dailyMap[d] ?? { total: 0, count: 0 };
    dailyMap[d].total += Number(r.total);
    dailyMap[d].count += 1;
  }
  const daily_trend = Object.entries(dailyMap)
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // By location
  const locMap: Record<string, { code: string; name: string; total: number; count: number }> = {};
  for (const r of rows) {
    const key = r.location_id;
    const code = r.locations?.code ?? "?";
    const name = r.locations?.name ?? "Unknown";
    locMap[key] = locMap[key] ?? { code, name, total: 0, count: 0 };
    locMap[key].total += Number(r.total);
    locMap[key].count += 1;
  }
  const by_location = Object.values(locMap)
    .map((v) => ({ location_code: v.code, location_name: v.name, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  // By payment mode
  const modeMap: Record<string, number> = {};
  for (const r of rows) {
    const m = r.payment_mode ?? "unknown";
    modeMap[m] = (modeMap[m] ?? 0) + Number(r.total);
  }
  const by_payment_mode = Object.entries(modeMap)
    .map(([mode, total]) => ({ mode, total }))
    .sort((a, b) => b.total - a.total);

  // Outstanding vs collected by month
  const monthMap: Record<string, { outstanding: number; collected: number }> = {};
  for (const r of rows) {
    const month = r.job_date.slice(0, 7);
    monthMap[month] = monthMap[month] ?? { outstanding: 0, collected: 0 };
    monthMap[month].outstanding += Number(r.outstanding);
    monthMap[month].collected += Number(r.total) - Number(r.outstanding);
  }
  const outstanding_vs_collected = Object.entries(monthMap)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Top 10 customers
  const custMap: Record<string, { total: number; count: number }> = {};
  for (const r of rows) {
    const name = r.billing_name;
    custMap[name] = custMap[name] ?? { total: 0, count: 0 };
    custMap[name].total += Number(r.total);
    custMap[name].count += 1;
  }
  const top_customers = Object.entries(custMap)
    .map(([billing_name, v]) => ({ billing_name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    period_label: label,
    total_revenue,
    total_jobs,
    avg_job_value,
    outstanding,
    daily_trend,
    by_location,
    by_payment_mode,
    outstanding_vs_collected,
    top_customers,
  };
}

// ============================================================================
// Jobs / duration analytics
// ============================================================================
export interface JobsAnalytics {
  period_label: string;
  avg_duration_minutes: number;
  total_jobs: number;
  fastest_bay: { bay_no: number; avg_minutes: number } | null;
  busiest_hour: { hour: number; count: number } | null;
  by_service_type: { code: string; name: string; avg_minutes: number; count: number }[];
  by_bay: { bay_no: number; avg_minutes: number; count: number }[];
  by_hour: { hour: number; count: number }[];
  by_dow: { dow: string; count: number }[];
  volume_trend: { day: string; count: number }[];
  duration_buckets: { bucket: string; count: number }[];
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getJobsAnalytics(filter: AnalyticsFilter = {}): Promise<JobsAnalytics> {
  const { supabase, locationId } = await scopedClient(filter);
  const { from, to, label } = defaultRange(filter);

  let q = supabase
    .from("sales_jobs")
    .select("id, job_date, start_time, end_time, duration_minutes, bay_no, service_type_id, service_types:service_type_id(code, name)")
    .is("deactivated_at", null)
    .gte("job_date", from)
    .lte("job_date", to);
  if (locationId) q = q.eq("location_id", locationId);
  if (filter.service_type_id) q = q.eq("service_type_id", filter.service_type_id);
  if (filter.bay_no) q = q.eq("bay_no", Number(filter.bay_no));

  const { data, error } = await q;
  if (error) throw error;
  type Row = { id: string; job_date: string; start_time: string | null; end_time: string | null; duration_minutes: number | null; bay_no: number | null; service_type_id: string; service_types: { code: string; name: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const withDuration = rows.filter((r) => r.duration_minutes != null && r.duration_minutes > 0);

  const total_jobs = rows.length;
  const avg_duration_minutes = withDuration.length > 0
    ? withDuration.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / withDuration.length
    : 0;

  // By service type
  const svcMap: Record<string, { code: string; name: string; total: number; count: number; durSum: number; durCount: number }> = {};
  for (const r of rows) {
    const key = r.service_type_id;
    const code = r.service_types?.code ?? "?";
    const name = r.service_types?.name ?? "Unknown";
    svcMap[key] = svcMap[key] ?? { code, name, total: 0, count: 0, durSum: 0, durCount: 0 };
    svcMap[key].count += 1;
    if (r.duration_minutes != null && r.duration_minutes > 0) {
      svcMap[key].durSum += r.duration_minutes;
      svcMap[key].durCount += 1;
    }
  }
  const by_service_type = Object.values(svcMap)
    .map((v) => ({ code: v.code, name: v.name, avg_minutes: v.durCount > 0 ? v.durSum / v.durCount : 0, count: v.count }))
    .sort((a, b) => b.count - a.count);

  // By bay
  const bayMap: Record<number, { count: number; durSum: number; durCount: number }> = {};
  for (const r of withDuration) {
    if (r.bay_no == null) continue;
    bayMap[r.bay_no] = bayMap[r.bay_no] ?? { count: 0, durSum: 0, durCount: 0 };
    bayMap[r.bay_no].count += 1;
    bayMap[r.bay_no].durSum += r.duration_minutes ?? 0;
    bayMap[r.bay_no].durCount += 1;
  }
  const by_bay = Object.entries(bayMap)
    .map(([bay, v]) => ({ bay_no: Number(bay), avg_minutes: v.durCount > 0 ? v.durSum / v.durCount : 0, count: v.count }))
    .sort((a, b) => a.bay_no - b.bay_no);

  const fastest_bay = by_bay.length > 0
    ? by_bay.reduce((acc, b) => (acc.avg_minutes < b.avg_minutes ? acc : b))
    : null;

  // By hour + dow + volume trend
  const hourMap: Record<number, number> = {};
  const dowMap: Record<number, number> = {};
  const volumeMap: Record<string, number> = {};
  for (const r of rows) {
    volumeMap[r.job_date] = (volumeMap[r.job_date] ?? 0) + 1;
    if (r.start_time) {
      const d = new Date(r.start_time);
      if (!Number.isNaN(d.getTime())) {
        hourMap[d.getHours()] = (hourMap[d.getHours()] ?? 0) + 1;
        dowMap[d.getDay()] = (dowMap[d.getDay()] ?? 0) + 1;
      }
    }
  }
  const by_hour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap[h] ?? 0 }));
  const by_dow = DOW.map((dow, i) => ({ dow, count: dowMap[i] ?? 0 }));
  const volume_trend = Object.entries(volumeMap)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const busiest_hour = by_hour.reduce<{ hour: number; count: number } | null>((acc, h) => {
    if (!acc || h.count > acc.count) return h;
    return acc;
  }, null);

  // Duration buckets
  const buckets = { "0–15 min": 0, "15–30 min": 0, "30–60 min": 0, "60+ min": 0 };
  for (const r of withDuration) {
    const m = r.duration_minutes ?? 0;
    if (m < 15) buckets["0–15 min"] += 1;
    else if (m < 30) buckets["15–30 min"] += 1;
    else if (m < 60) buckets["30–60 min"] += 1;
    else buckets["60+ min"] += 1;
  }
  const duration_buckets = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));

  return {
    period_label: label,
    avg_duration_minutes,
    total_jobs,
    fastest_bay,
    busiest_hour,
    by_service_type,
    by_bay,
    by_hour,
    by_dow,
    volume_trend,
    duration_buckets,
  };
}

// ============================================================================
// Products / services analytics
// ============================================================================
export interface ProductsAnalytics {
  period_label: string;
  total_jobs: number;
  most_performed: string | null;
  highest_revenue: string | null;
  by_count: { code: string; name: string; count: number }[];
  by_revenue: { code: string; name: string; total: number }[];
  trend: { month: string; [code: string]: number | string }[];
  by_location: { name: string; code: string; count: number }[];
}

export async function getProductsAnalytics(filter: AnalyticsFilter = {}): Promise<ProductsAnalytics> {
  const { supabase, locationId } = await scopedClient(filter);
  const { from, to, label } = defaultRange(filter);

  let q = supabase
    .from("sales_jobs")
    .select("id, job_date, total, service_type_id, location_id, service_types:service_type_id(code, name), locations:location_id(name)")
    .is("deactivated_at", null)
    .gte("job_date", from)
    .lte("job_date", to);
  if (locationId) q = q.eq("location_id", locationId);

  const { data, error } = await q;
  if (error) throw error;
  type Row = { id: string; job_date: string; total: number; service_type_id: string; location_id: string; service_types: { code: string; name: string } | null; locations: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];

  const countMap: Record<string, { code: string; name: string; count: number; total: number }> = {};
  for (const r of rows) {
    const code = r.service_types?.code ?? "?";
    const name = r.service_types?.name ?? "Unknown";
    countMap[code] = countMap[code] ?? { code, name, count: 0, total: 0 };
    countMap[code].count += 1;
    countMap[code].total += Number(r.total);
  }

  const by_count = Object.values(countMap).map((v) => ({ code: v.code, name: v.name, count: v.count }));
  const by_revenue = Object.values(countMap).map((v) => ({ code: v.code, name: v.name, total: v.total }));

  const most = by_count.sort((a, b) => b.count - a.count)[0];
  const highest = by_revenue.sort((a, b) => b.total - a.total)[0];

  // Monthly trend per service code
  const trendMap: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const month = r.job_date.slice(0, 7);
    const code = r.service_types?.code ?? "?";
    trendMap[month] = trendMap[month] ?? {};
    trendMap[month][code] = (trendMap[month][code] ?? 0) + 1;
  }
  const trend = Object.entries(trendMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, cats]) => ({ month, ...cats } as { month: string; [code: string]: number | string }));

  // Per location
  const locMap: Record<string, { name: string; code: string; count: number }> = {};
  for (const r of rows) {
    const key = `${r.location_id}|${r.service_types?.code ?? "?"}`;
    const name = r.locations?.name ?? "Unknown";
    const code = r.service_types?.code ?? "?";
    locMap[key] = locMap[key] ?? { name, code, count: 0 };
    locMap[key].count += 1;
  }
  const by_location = Object.values(locMap);

  return {
    period_label: label,
    total_jobs: rows.length,
    most_performed: most ? `${most.code} — ${most.name}` : null,
    highest_revenue: highest ? `${highest.code} — ${highest.name}` : null,
    by_count,
    by_revenue,
    trend,
    by_location,
  };
}

// ============================================================================
// Expense analytics
// ============================================================================
export interface ExpenseAnalytics {
  period_label: string;
  total_expenses: number;
  largest_category: { name: string; total: number } | null;
  top_vendor: { name: string; total: number } | null;
  outstanding_payables: number;
  by_category: { name: string; total: number }[];
  by_location: { name: string; total: number }[];
  monthly_trend: { month: string; total: number }[];
  top_vendors: { name: string; total: number }[];
  paid_vs_outstanding: { month: string; paid: number; outstanding: number }[];
}

export async function getExpenseAnalytics(filter: AnalyticsFilter = {}): Promise<ExpenseAnalytics> {
  const { supabase, locationId } = await scopedClient(filter);
  const { from, to, label } = defaultRange(filter);

  let q = supabase
    .from("expenses")
    .select("id, expense_date, total, paid_amount, balance, category_id, vendor_id, vendor_name_snapshot, location_id, expense_categories:category_id(name), locations:location_id(name), vendors:vendor_id(name)")
    .is("deactivated_at", null)
    .gte("expense_date", from)
    .lte("expense_date", to);
  if (locationId) q = q.eq("location_id", locationId);
  if (filter.category_id) q = q.eq("category_id", filter.category_id);
  if (filter.vendor_id) q = q.eq("vendor_id", filter.vendor_id);

  const { data, error } = await q;
  if (error) throw error;
  type Row = { id: string; expense_date: string; total: number; paid_amount: number; balance: number; category_id: string; vendor_id: string | null; vendor_name_snapshot: string | null; location_id: string; expense_categories: { name: string } | null; locations: { name: string } | null; vendors: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];

  const total_expenses = rows.reduce((s, r) => s + Number(r.total), 0);
  const outstanding_payables = rows.reduce((s, r) => s + Number(r.balance), 0);

  // By category
  const catMap: Record<string, number> = {};
  for (const r of rows) {
    const name = r.expense_categories?.name ?? "Uncategorized";
    catMap[name] = (catMap[name] ?? 0) + Number(r.total);
  }
  const by_category = Object.entries(catMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
  const largest_category = by_category[0] ?? null;

  // By location
  const locMap: Record<string, number> = {};
  for (const r of rows) {
    const name = r.locations?.name ?? "Unknown";
    locMap[name] = (locMap[name] ?? 0) + Number(r.total);
  }
  const by_location = Object.entries(locMap).map(([name, total]) => ({ name, total }));

  // Monthly trend
  const monthMap: Record<string, number> = {};
  for (const r of rows) {
    const month = r.expense_date.slice(0, 7);
    monthMap[month] = (monthMap[month] ?? 0) + Number(r.total);
  }
  const monthly_trend = Object.entries(monthMap)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Top vendors
  const vendorMap: Record<string, number> = {};
  for (const r of rows) {
    const name = r.vendors?.name ?? r.vendor_name_snapshot ?? "Unknown";
    vendorMap[name] = (vendorMap[name] ?? 0) + Number(r.total);
  }
  const top_vendors = Object.entries(vendorMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const top_vendor = top_vendors[0] ?? null;

  // Paid vs outstanding by month
  const pvo: Record<string, { paid: number; outstanding: number }> = {};
  for (const r of rows) {
    const month = r.expense_date.slice(0, 7);
    pvo[month] = pvo[month] ?? { paid: 0, outstanding: 0 };
    pvo[month].paid += Number(r.paid_amount);
    pvo[month].outstanding += Number(r.balance);
  }
  const paid_vs_outstanding = Object.entries(pvo)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    period_label: label,
    total_expenses,
    largest_category,
    top_vendor,
    outstanding_payables,
    by_category,
    by_location,
    monthly_trend,
    top_vendors,
    paid_vs_outstanding,
  };
}

// ============================================================================
// Payroll analytics
// ============================================================================
export interface PayrollAnalytics {
  period_label: string;
  total_cost: number;
  total_employees: number;
  by_location: { name: string; total: number }[];
  avg_weekly_per_employee: number;
  weekly_trend: { week_start: string; total: number; location_name: string }[];
  deductions: { month: string; ei: number; cpp: number; tax: number; benefits: number }[];
  payroll_vs_revenue_pct: number;
}

export async function getPayrollAnalytics(filter: AnalyticsFilter = {}): Promise<PayrollAnalytics> {
  const { supabase, profile, locationId } = await scopedClient(filter);
  if (profile.role === "staff" || profile.role === "employee") {
    throw new Error("Unauthorized");
  }
  const { from, to, label } = defaultRange(filter);

  let q = supabase
    .from("payroll_entries")
    .select(`
      id, gross_wages, bonus, misc_extra, ei_employee, cpp_employee, income_tax,
      benefit_employee_deduction, benefit_employer_contribution, cheque_amount, cash_total, net_pay, employee_id,
      payroll_weeks!inner(id, week_start, location_id, locations:location_id(name))
    `)
    .gte("payroll_weeks.week_start", from)
    .lte("payroll_weeks.week_start", to);
  if (locationId) q = q.eq("payroll_weeks.location_id", locationId);

  const { data, error } = await q;
  if (error) throw error;
  type Row = {
    id: string;
    gross_wages: number; bonus: number; misc_extra: number;
    ei_employee: number; cpp_employee: number; income_tax: number;
    benefit_employee_deduction: number; benefit_employer_contribution: number;
    cheque_amount: number; cash_total: number; net_pay: number;
    employee_id: string;
    payroll_weeks: { id: string; week_start: string; location_id: string; locations: { name: string } | null };
  };
  const rows = (data ?? []) as unknown as Row[];

  const total_cost = rows.reduce((s, r) => s + Number(r.gross_wages) + Number(r.bonus) + Number(r.misc_extra) + Number(r.benefit_employer_contribution), 0);
  const employees = new Set(rows.map((r) => r.employee_id));
  const total_employees = employees.size;

  // By location
  const locMap: Record<string, number> = {};
  for (const r of rows) {
    const name = r.payroll_weeks.locations?.name ?? "Unknown";
    locMap[name] = (locMap[name] ?? 0) + Number(r.gross_wages) + Number(r.bonus) + Number(r.misc_extra);
  }
  const by_location = Object.entries(locMap).map(([name, total]) => ({ name, total }));

  // Weekly trend
  const weekMap: Record<string, { total: number; location_name: string }> = {};
  for (const r of rows) {
    const key = `${r.payroll_weeks.week_start}|${r.payroll_weeks.locations?.name ?? ""}`;
    const name = r.payroll_weeks.locations?.name ?? "Unknown";
    weekMap[key] = weekMap[key] ?? { total: 0, location_name: name };
    weekMap[key].total += Number(r.gross_wages) + Number(r.bonus) + Number(r.misc_extra);
  }
  const weekly_trend = Object.entries(weekMap)
    .map(([key, v]) => {
      const [week_start] = key.split("|");
      return { week_start, total: v.total, location_name: v.location_name };
    })
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  const weekCount = new Set(rows.map((r) => r.payroll_weeks.week_start)).size;
  const avg_weekly_per_employee = weekCount > 0 && total_employees > 0
    ? total_cost / weekCount / total_employees
    : 0;

  // Deductions by month
  const dedMap: Record<string, { ei: number; cpp: number; tax: number; benefits: number }> = {};
  for (const r of rows) {
    const month = r.payroll_weeks.week_start.slice(0, 7);
    dedMap[month] = dedMap[month] ?? { ei: 0, cpp: 0, tax: 0, benefits: 0 };
    dedMap[month].ei += Number(r.ei_employee);
    dedMap[month].cpp += Number(r.cpp_employee);
    dedMap[month].tax += Number(r.income_tax);
    dedMap[month].benefits += Number(r.benefit_employee_deduction);
  }
  const deductions = Object.entries(dedMap)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Payroll as % of revenue (over same window)
  let salesQ = supabase
    .from("sales_jobs")
    .select("total")
    .is("deactivated_at", null)
    .gte("job_date", from)
    .lte("job_date", to);
  if (locationId) salesQ = salesQ.eq("location_id", locationId);
  const { data: salesData } = await salesQ;
  const revenue = ((salesData ?? []) as { total: number }[]).reduce((s, r) => s + Number(r.total), 0);
  const payroll_vs_revenue_pct = revenue > 0 ? (total_cost / revenue) * 100 : 0;

  return {
    period_label: label,
    total_cost,
    total_employees,
    by_location,
    avg_weekly_per_employee,
    weekly_trend,
    deductions,
    payroll_vs_revenue_pct,
  };
}
