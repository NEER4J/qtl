"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/require";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export interface LocationSummaryRow {
  location_id: string;
  name: string;
  sales_total: number;
  expense_total: number;
  outstanding: number;
  job_count: number;
}

export interface DailySalesTrendRow {
  day: string;
  total: number;
  job_count: number;
}

export interface ExpenseBreakdownRow {
  category_name: string;
  total: number;
}

export interface DashboardOverview {
  period_label: string;
  sales_total: number;
  expense_total: number;
  net: number;
  outstanding: number;
  job_count: number;
  locations: LocationSummaryRow[];
  daily_trend: DailySalesTrendRow[];
  expense_breakdown: ExpenseBreakdownRow[];
  prior_sales_total: number;
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);
  const priorFrom = startOfMonth(subMonths(now, 1));
  const priorTo = endOfMonth(subMonths(now, 1));

  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");
  const priorFromStr = format(priorFrom, "yyyy-MM-dd");
  const priorToStr = format(priorTo, "yyyy-MM-dd");

  // Build location filter if scoped
  const isScoped = profile.role === "manager" || profile.role === "staff";
  const locationId = profile.location_id;

  async function salesQuery(f: string, t: string) {
    let q = supabase
      .from("sales_jobs")
      .select("total, outstanding, location_id")
      .is("deactivated_at", null)
      .gte("job_date", f)
      .lte("job_date", t);
    if (isScoped && locationId) q = q.eq("location_id", locationId);
    return q;
  }

  async function expenseQuery(f: string, t: string) {
    let q = supabase
      .from("expenses")
      .select("total, location_id")
      .is("deactivated_at", null)
      .gte("expense_date", f)
      .lte("expense_date", t);
    if (isScoped && locationId) q = q.eq("location_id", locationId);
    return q;
  }

  const [salesRes, expensesRes, priorSalesRes, locationsRes, dailyRes, categoryRes] =
    await Promise.all([
      salesQuery(fromStr, toStr),
      expenseQuery(fromStr, toStr),
      salesQuery(priorFromStr, priorToStr),
      // All locations for breakdown
      supabase.from("locations").select("id, name").eq("active", true),
      // Daily trend
      (async () => {
        let q = supabase
          .from("sales_jobs")
          .select("job_date, total")
          .is("deactivated_at", null)
          .gte("job_date", fromStr)
          .lte("job_date", toStr);
        if (isScoped && locationId) q = q.eq("location_id", locationId);
        return q;
      })(),
      // Expense breakdown by category
      (async () => {
        let q = supabase
          .from("expenses")
          .select("total, expense_categories(name)")
          .is("deactivated_at", null)
          .gte("expense_date", fromStr)
          .lte("expense_date", toStr);
        if (isScoped && locationId) q = q.eq("location_id", locationId);
        return q;
      })(),
    ]);

  const salesRows = (salesRes.data ?? []) as Array<{ total: number; outstanding: number; location_id: string }>;
  const expenseRows = (expensesRes.data ?? []) as Array<{ total: number; location_id: string }>;
  const priorSalesRows = (priorSalesRes.data ?? []) as Array<{ total: number }>;
  const allLocations = (locationsRes.data ?? []) as Array<{ id: string; name: string }>;

  const sales_total = salesRows.reduce((s, r) => s + Number(r.total), 0);
  const expense_total = expenseRows.reduce((s, r) => s + Number(r.total), 0);
  const outstanding = salesRows.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
  const prior_sales_total = priorSalesRows.reduce((s, r) => s + Number(r.total), 0);

  // Per-location breakdown (owner/accountant only)
  const locations: LocationSummaryRow[] = allLocations.map((loc) => {
    const locSales = salesRows.filter((r) => r.location_id === loc.id);
    const locExp = expenseRows.filter((r) => r.location_id === loc.id);
    return {
      location_id: loc.id,
      name: loc.name,
      sales_total: locSales.reduce((s, r) => s + Number(r.total), 0),
      expense_total: locExp.reduce((s, r) => s + Number(r.total), 0),
      outstanding: locSales.reduce((s, r) => s + Number(r.outstanding ?? 0), 0),
      job_count: locSales.length,
    };
  });

  // Daily trend — aggregate client-side to avoid needing a SQL function
  const dailyMap: Record<string, { total: number; count: number }> = {};
  for (const r of (dailyRes.data ?? []) as Array<{ job_date: string; total: number }>) {
    if (!dailyMap[r.job_date]) dailyMap[r.job_date] = { total: 0, count: 0 };
    dailyMap[r.job_date].total += Number(r.total);
    dailyMap[r.job_date].count += 1;
  }
  const daily_trend: DailySalesTrendRow[] = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, { total, count }]) => ({ day, total, job_count: count }));

  // Expense breakdown by category
  const catMap: Record<string, number> = {};
  for (const r of (categoryRes.data ?? []) as unknown as Array<{
    total: number;
    expense_categories: { name: string } | null;
  }>) {
    const name = r.expense_categories?.name ?? "Uncategorized";
    catMap[name] = (catMap[name] ?? 0) + Number(r.total);
  }
  const expense_breakdown: ExpenseBreakdownRow[] = Object.entries(catMap)
    .map(([category_name, total]) => ({ category_name, total }))
    .sort((a, b) => b.total - a.total);

  return {
    period_label: format(now, "MMMM yyyy"),
    sales_total,
    expense_total,
    net: sales_total - expense_total,
    outstanding,
    job_count: salesRows.length,
    locations: isScoped ? locations.filter((l) => l.location_id === locationId) : locations,
    daily_trend,
    expense_breakdown,
    prior_sales_total,
  };
}

export interface OverdueJob {
  id: string;
  invoice_no: string;
  job_date: string;
  billing_name: string;
  outstanding: number;
  days_overdue: number;
}

export async function getOverdueJobs(thresholdDays = 30): Promise<OverdueJob[]> {
  const supabase = await createClient();
  const cutoff = format(
    new Date(Date.now() - thresholdDays * 86400_000),
    "yyyy-MM-dd",
  );

  const { data, error } = await supabase
    .from("sales_jobs")
    .select("id, invoice_no, job_date, billing_name, outstanding")
    .in("payment_status", ["outstanding", "partial"])
    .is("deactivated_at", null)
    .lte("job_date", cutoff)
    .order("job_date", { ascending: true })
    .limit(20);

  if (error) return [];

  const today = Date.now();
  return ((data ?? []) as OverdueJob[]).map((r) => ({
    ...r,
    days_overdue: Math.floor((today - new Date(r.job_date).getTime()) / 86400_000),
  }));
}
