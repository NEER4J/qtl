import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  Minus,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/require";
import { getDashboardOverview, getOverdueJobs } from "@/lib/actions/dashboard";
import { formatMoney } from "@/lib/utils/format";

import { DailyRevenueChart } from "./daily-revenue-chart";
import { ExpenseBreakdownChart } from "./expense-breakdown-chart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireProfile();
  const [data, overdueJobs] = await Promise.all([
    getDashboardOverview(),
    getOverdueJobs(30),
  ]);

  const salesChange =
    data.prior_sales_total > 0
      ? ((data.sales_total - data.prior_sales_total) / data.prior_sales_total) * 100
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Sales revenue"
          value={formatMoney(data.sales_total)}
          sub={
            salesChange !== null ? (
              <span
                className={`flex items-center gap-1 text-xs ${
                  salesChange >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {salesChange >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {Math.abs(salesChange).toFixed(1)}% vs last month
              </span>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Minus className="size-3" /> No prior month data
              </span>
            )
          }
          icon={<DollarSign className="size-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Expenses"
          value={formatMoney(data.expense_total)}
          sub={<span className="text-xs text-muted-foreground">This month</span>}
          icon={<ShoppingCart className="size-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Net"
          value={formatMoney(data.net)}
          sub={
            <span
              className={`text-xs font-medium ${
                data.net >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {data.net >= 0 ? "Positive" : "Negative"}
            </span>
          }
          icon={<DollarSign className="size-4 text-muted-foreground" />}
          highlight={data.net >= 0 ? "positive" : "negative"}
        />
        <SummaryCard
          title="Outstanding"
          value={formatMoney(data.outstanding)}
          sub={
            <span className="text-xs text-muted-foreground">
              {data.job_count} job{data.job_count !== 1 ? "s" : ""} this month
            </span>
          }
          icon={<AlertCircle className="size-4 text-muted-foreground" />}
          highlight={data.outstanding > 0 ? "warning" : undefined}
        />
      </div>

      {/* Per-location table (owner/accountant) */}
      {data.locations.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>By location — {data.period_label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Location</th>
                    <th className="pb-2 font-medium text-right">Jobs</th>
                    <th className="pb-2 font-medium text-right">Sales</th>
                    <th className="pb-2 font-medium text-right">Expenses</th>
                    <th className="pb-2 font-medium text-right">Net</th>
                    <th className="pb-2 font-medium text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.locations.map((loc) => (
                    <tr key={loc.location_id}>
                      <td className="py-2 font-medium">{loc.name}</td>
                      <td className="py-2 text-right tabular-nums">{loc.job_count}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(loc.sales_total)}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(loc.expense_total)}</td>
                      <td
                        className={`py-2 text-right tabular-nums font-medium ${
                          loc.sales_total - loc.expense_total >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {formatMoney(loc.sales_total - loc.expense_total)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatMoney(loc.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right tabular-nums">
                      {data.locations.reduce((s, l) => s + l.job_count, 0)}
                    </td>
                    <td className="pt-2 text-right tabular-nums">{formatMoney(data.sales_total)}</td>
                    <td className="pt-2 text-right tabular-nums">{formatMoney(data.expense_total)}</td>
                    <td
                      className={`pt-2 text-right tabular-nums ${
                        data.net >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {formatMoney(data.net)}
                    </td>
                    <td className="pt-2 text-right tabular-nums">{formatMoney(data.outstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue outstanding alert */}
      {overdueJobs.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-600" />
              {overdueJobs.length} invoice{overdueJobs.length !== 1 ? "s" : ""} overdue 30+ days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {overdueJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Link href={`/sales/${j.id}`} className="font-mono hover:underline">
                      #{j.invoice_no}
                    </Link>
                    <span className="text-muted-foreground">{j.billing_name}</span>
                    <span className="text-xs text-amber-600">({j.days_overdue}d overdue)</span>
                  </div>
                  <span className="tabular-nums font-medium text-rose-600">
                    {formatMoney(j.outstanding)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DailyRevenueChart data={data.daily_trend} />
        </div>
        <ExpenseBreakdownChart data={data.expense_breakdown} />
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  sub,
  icon,
  highlight,
}: {
  title: string;
  value: string;
  sub: React.ReactNode;
  icon: React.ReactNode;
  highlight?: "positive" | "negative" | "warning";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold tabular-nums ${
            highlight === "positive"
              ? "text-emerald-600"
              : highlight === "negative"
              ? "text-rose-600"
              : highlight === "warning"
              ? "text-amber-600"
              : ""
          }`}
        >
          {value}
        </div>
        <div className="mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
