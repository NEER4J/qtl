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
  comparison_label: string;
  granularity: "day" | "month";
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

/** period: "YYYY-MM" for a single month, or "3m" | "6m" | "12m" for a trailing range. */
export async function getDashboardOverview(period?: string): Promise<DashboardOverview> {
  await requireProfile();
  const supabase = await createClient();

  const now = new Date();
  const rangeMonths =
    period === "3m" ? 3 : period === "6m" ? 6 : period === "12m" ? 12 : null;
  const anchor =
    !rangeMonths && period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
      ? new Date(`${period}-01T00:00:00`)
      : now;

  let from: Date, to: Date, priorFrom: Date, priorTo: Date;
  let period_label: string, comparison_label: string;
  if (rangeMonths) {
    from = startOfMonth(subMonths(now, rangeMonths - 1));
    to = endOfMonth(now);
    priorFrom = startOfMonth(subMonths(now, rangeMonths * 2 - 1));
    priorTo = endOfMonth(subMonths(now, rangeMonths));
    period_label = `${format(from, "MMM yyyy")} – ${format(to, "MMM yyyy")}`;
    comparison_label = `prior ${rangeMonths} months`;
  } else {
    from = startOfMonth(anchor);
    to = endOfMonth(anchor);
    priorFrom = startOfMonth(subMonths(anchor, 1));
    priorTo = endOfMonth(subMonths(anchor, 1));
    period_label = format(anchor, "MMMM yyyy");
    comparison_label = "last month";
  }
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  // All reads go through the security-definer aggregate functions (0008/0129):
  // row-level fetches are capped at 1000 rows by PostgREST, which would
  // silently under-report multi-month ranges.
  const [locRes, priorRes, trendRes, catRes] = await Promise.all([
    supabase.rpc("my_dashboard", { p_from: fmt(from), p_to: fmt(to) }),
    supabase.rpc("my_dashboard", { p_from: fmt(priorFrom), p_to: fmt(priorTo) }),
    rangeMonths
      ? supabase.rpc("monthly_sales_trend", { p_from: fmt(from), p_to: fmt(to) })
      : supabase.rpc("daily_sales_trend", { p_from: fmt(from), p_to: fmt(to) }),
    supabase.rpc("expense_breakdown_by_category", { p_from: fmt(from), p_to: fmt(to) }),
  ]);

  // Surface a swallowed query error instead of silently reporting $0 — e.g. the
  // expense card reading 0 when the expenses query actually errored (RLS/column).
  if (locRes.error) throw locRes.error;
  if (priorRes.error) throw priorRes.error;
  if (trendRes.error) throw trendRes.error;
  if (catRes.error) throw catRes.error;

  const locations: LocationSummaryRow[] = (
    (locRes.data ?? []) as Array<{
      location_id: string;
      location_name: string;
      sales_total: number;
      expense_total: number;
      outstanding: number;
      job_count: number;
    }>
  ).map((r) => ({
    location_id: r.location_id,
    name: r.location_name,
    sales_total: Number(r.sales_total),
    expense_total: Number(r.expense_total),
    outstanding: Number(r.outstanding),
    job_count: r.job_count,
  }));

  const sales_total = locations.reduce((s, l) => s + l.sales_total, 0);
  const expense_total = locations.reduce((s, l) => s + l.expense_total, 0);
  const outstanding = locations.reduce((s, l) => s + l.outstanding, 0);
  const job_count = locations.reduce((s, l) => s + l.job_count, 0);
  const prior_sales_total = (
    (priorRes.data ?? []) as Array<{ sales_total: number }>
  ).reduce((s, r) => s + Number(r.sales_total), 0);

  let daily_trend: DailySalesTrendRow[];
  if (rangeMonths) {
    daily_trend = (
      (trendRes.data ?? []) as Array<{ month: string; sales_total: number; job_count: number }>
    ).map((r) => ({ day: r.month, total: Number(r.sales_total), job_count: r.job_count }));
  } else {
    // daily_sales_trend returns one row per day per location — roll up days.
    const dailyMap: Record<string, { total: number; count: number }> = {};
    for (const r of (trendRes.data ?? []) as Array<{
      day: string;
      sales_total: number;
      job_count: number;
    }>) {
      if (!dailyMap[r.day]) dailyMap[r.day] = { total: 0, count: 0 };
      dailyMap[r.day].total += Number(r.sales_total);
      dailyMap[r.day].count += r.job_count;
    }
    daily_trend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, { total, count }]) => ({ day, total, job_count: count }));
  }

  const expense_breakdown: ExpenseBreakdownRow[] = (
    (catRes.data ?? []) as Array<{ category_name: string; total: number }>
  )
    .map((r) => ({ category_name: r.category_name, total: Number(r.total) }))
    .filter((r) => r.total !== 0)
    .sort((a, b) => b.total - a.total);

  return {
    period_label,
    comparison_label,
    granularity: rangeMonths ? "month" : "day",
    sales_total,
    expense_total,
    net: sales_total - expense_total,
    outstanding,
    job_count,
    locations,
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
