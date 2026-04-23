import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { PageHelp } from "@/components/help/page-help";
import { StackedBar } from "@/components/analytics/charts";
import { requireProfile } from "@/lib/auth/require";
import { getPnlReport } from "@/lib/actions/reports";
import { listActiveLocations } from "@/lib/actions/reference";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PnlReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  if (profile.role === "staff" || profile.role === "employee") notFound();
  const sp = await searchParams;

  const [data, locations] = await Promise.all([
    getPnlReport({ from: sp.from, to: sp.to, location_id: sp.location_id }),
    listActiveLocations(),
  ]);

  const netColor = data.net_profit >= 0 ? "text-emerald-600" : "text-rose-600";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">P&amp;L Report</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      <PageHelp id="reports-pnl">
        <p>Profit and loss. Net profit equals sales minus expenses minus payroll.</p>
        <ul>
          <li>Broken down by month and by shop so you can see which shop or which month is driving the numbers.</li>
          <li>Sales and expenses include HST. Payroll includes gross wages plus bonus, extras, and your share of benefits.</li>
          <li>Green net means profit, red means loss.</li>
        </ul>
      </PageHelp>

      <AnalyticsFilters
        locations={locations}
        canFilterLocation={profile.role !== "manager"}
        exportHref="/api/export/pnl"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Sales" value={formatMoney(data.sales_total)} accent="pos" />
        <Stat label="Expenses" value={formatMoney(data.expense_total)} accent="neg" />
        <Stat label="Payroll" value={formatMoney(data.payroll_total)} accent="neg" />
        <Stat label="Net profit" value={formatMoney(data.net_profit)} accent={data.net_profit >= 0 ? "pos" : "neg"} big />
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly breakdown</CardTitle></CardHeader>
        <CardContent>
          {data.by_month.length > 0 ? (
            <StackedBar data={data.by_month.map((m) => ({ month: m.month, sales: m.sales, expenses: -m.expenses, payroll: -m.payroll }))} xKey="month" keys={["sales", "expenses", "payroll"]} money />
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data for this period.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>By month</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.by_month.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No data for this period.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Payroll</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_month.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(r.sales)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(r.expenses)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(r.payroll)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${r.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(r.net)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(data.sales_total)}</TableCell>
                  <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(data.expense_total)}</TableCell>
                  <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(data.payroll_total)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${netColor}`}>{formatMoney(data.net_profit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.by_location.length > 1 && (
        <Card>
          <CardHeader><CardTitle>By location</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Payroll</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_location.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(r.sales)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(r.expenses)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(r.payroll)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${r.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, accent, big }: { label: string; value: string; accent?: "pos" | "neg"; big?: boolean }) {
  const color = accent === "pos" ? "text-emerald-600" : accent === "neg" ? "text-rose-600" : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`${big ? "text-3xl" : "text-2xl"} font-bold tabular-nums mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
