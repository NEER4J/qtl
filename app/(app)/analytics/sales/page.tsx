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
import { SimpleArea, SimpleBar, SimplePie, StackedBar } from "@/components/analytics/charts";
import { requireProfile } from "@/lib/auth/require";
import { getSalesAnalytics } from "@/lib/actions/analytics";
import { listActiveLocations } from "@/lib/actions/reference";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function SalesAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;

  const [data, locations] = await Promise.all([
    getSalesAnalytics({
      from: sp.from,
      to: sp.to,
      location_id: sp.location_id,
      service_type_id: sp.service_type_id,
      payment_mode: sp.payment_mode,
    }),
    listActiveLocations(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales & Revenue</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      <AnalyticsFilters
        locations={locations}
        canFilterLocation={profile.role !== "manager"}
        exportHref="/api/export/sales-analytics"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total revenue" value={formatMoney(data.total_revenue)} />
        <Stat label="Total jobs" value={data.total_jobs.toLocaleString()} />
        <Stat label="Avg job value" value={formatMoney(data.avg_job_value)} />
        <Stat label="Outstanding" value={formatMoney(data.outstanding)} accent={data.outstanding > 0 ? "warn" : undefined} />
      </div>

      {/* Daily trend */}
      <Card>
        <CardHeader><CardTitle>Daily revenue trend</CardTitle></CardHeader>
        <CardContent>
          {data.daily_trend.length > 0 ? (
            <SimpleArea data={data.daily_trend} xKey="day" yKey="total" money />
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by location */}
        <Card>
          <CardHeader><CardTitle>Revenue by location</CardTitle></CardHeader>
          <CardContent>
            {data.by_location.length > 0 ? (
              <SimpleBar data={data.by_location} xKey="location_name" yKey="total" money />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* Payment modes */}
        <Card>
          <CardHeader><CardTitle>Revenue by payment mode</CardTitle></CardHeader>
          <CardContent>
            {data.by_payment_mode.length > 0 ? (
              <SimplePie data={data.by_payment_mode} nameKey="mode" valueKey="total" money />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outstanding vs collected */}
      <Card>
        <CardHeader><CardTitle>Outstanding vs collected (monthly)</CardTitle></CardHeader>
        <CardContent>
          {data.outstanding_vs_collected.length > 0 ? (
            <StackedBar data={data.outstanding_vs_collected} xKey="month" keys={["collected", "outstanding"]} money />
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      {/* Top customers */}
      <Card>
        <CardHeader><CardTitle>Top customers</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.top_customers.length === 0 ? (
            <EmptyChart />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_customers.map((c) => (
                  <TableRow key={c.billing_name}>
                    <TableCell className="font-medium">{c.billing_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(c.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "warn" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold tabular-nums mt-1 ${accent === "warn" ? "text-amber-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data for selected filters.</div>;
}
