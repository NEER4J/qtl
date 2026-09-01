import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { PageHelp } from "@/components/help/page-help";
import { SimpleBar, SimpleLine, StackedBar } from "@/components/analytics/charts";
import { requirePage } from "@/lib/auth/require";
import { getPayrollAnalytics } from "@/lib/actions/analytics";
import { listActiveLocations } from "@/lib/actions/reference";
import { formatMoney } from "@/lib/utils/format";
import { canChooseLocation } from "@/lib/auth/locations";

export const dynamic = "force-dynamic";

export default async function PayrollAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requirePage("analytics_payroll");
  const sp = await searchParams;

  const [data, locations] = await Promise.all([
    getPayrollAnalytics({
      from: sp.from,
      to: sp.to,
      location_id: sp.location_id,
    }),
    listActiveLocations(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Analytics</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      <PageHelp id="analytics-payroll">
        <p>
          Covers payroll weeks whose Monday falls inside the selected period. A week only counts once at least one entry has been added to it.
        </p>
        <ul>
          <li><strong>Total cost</strong> — gross wages plus bonus, extras, and your share of benefits. This is what the week costs <em>you</em> as the employer, which is more than what lands in employees&apos; pockets.</li>
          <li><strong>% of revenue</strong> — labour cost divided by sales. A key health-of-the-business number; watch for creep month to month.</li>
          <li><strong>Deductions breakdown</strong> — EI, CPP, income tax, and benefit deductions by month. These are amounts you remit to CRA.</li>
        </ul>
        <p>Owner and accountant only. Managers don&apos;t see company-wide payroll totals.</p>
      </PageHelp>

      <AnalyticsFilters
        locations={locations}
        canFilterLocation={canChooseLocation(profile)}
        exportHref="/api/export/payroll-analytics"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total payroll cost" value={formatMoney(data.total_cost)} />
        <Stat label="Employees" value={data.total_employees.toLocaleString()} />
        <Stat label="Avg weekly / employee" value={formatMoney(data.avg_weekly_per_employee)} />
        <Stat label="% of revenue" value={`${data.payroll_vs_revenue_pct.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Payroll by location</CardTitle></CardHeader>
          <CardContent>
            {data.by_location.length > 0 ? (
              <SimpleBar data={data.by_location} xKey="name" yKey="total" money />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Weekly payroll cost trend</CardTitle></CardHeader>
          <CardContent>
            {data.weekly_trend.length > 0 ? (
              <SimpleLine data={data.weekly_trend} xKey="week_start" yKey="total" money />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Deductions breakdown (monthly)</CardTitle></CardHeader>
          <CardContent>
            {data.deductions.length > 0 ? (
              <StackedBar data={data.deductions} xKey="month" keys={["ei", "cpp", "tax", "benefits"]} money />
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data for selected filters.</div>;
}
