import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { PageHelp } from "@/components/help/page-help";
import { SimpleBar, SimplePie, StackedBar } from "@/components/analytics/charts";
import { requireProfile } from "@/lib/auth/require";
import { getProductsAnalytics } from "@/lib/actions/analytics";
import { listActiveLocations } from "@/lib/actions/reference";

export const dynamic = "force-dynamic";

export default async function ProductsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;

  const [data, locations] = await Promise.all([
    getProductsAnalytics({
      from: sp.from,
      to: sp.to,
      location_id: sp.location_id,
    }),
    listActiveLocations(),
  ]);

  const serviceCodes = Array.from(new Set(data.by_count.map((b) => b.code)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products & Services</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      <PageHelp id="analytics-products">
        <p>
          What you&apos;re selling. The four service types are oil change, premium grease, full grease, and miscellaneous.
        </p>
        <ul>
          <li><strong>Count breakdown</strong> — how many of each service you&apos;ve performed.</li>
          <li><strong>Revenue breakdown</strong> — which service brings in the most money. Sometimes this differs from count: miscellaneous jobs often have a higher ticket than standard oil changes.</li>
          <li><strong>Trend by month</strong> — the mix shifting over time.</li>
        </ul>
      </PageHelp>

      <AnalyticsFilters locations={locations} canFilterLocation={profile.role !== "manager"} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Total jobs" value={data.total_jobs.toLocaleString()} />
        <Stat label="Most performed" value={data.most_performed ?? "—"} />
        <Stat label="Highest revenue" value={data.highest_revenue ?? "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Service count breakdown</CardTitle></CardHeader>
          <CardContent>
            {data.by_count.length > 0 ? (
              <SimplePie data={data.by_count} nameKey="code" valueKey="count" />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Service revenue breakdown</CardTitle></CardHeader>
          <CardContent>
            {data.by_revenue.length > 0 ? (
              <SimplePie data={data.by_revenue} nameKey="code" valueKey="total" money />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Service type trend by month</CardTitle></CardHeader>
          <CardContent>
            {data.trend.length > 0 && serviceCodes.length > 0 ? (
              <StackedBar data={data.trend} xKey="month" keys={serviceCodes} />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Services per location</CardTitle></CardHeader>
          <CardContent>
            {data.by_location.length > 0 ? (
              <SimpleBar data={data.by_location.map((l) => ({ ...l, label: `${l.name} · ${l.code}` }))} xKey="label" yKey="count" horizontal />
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
        <div className="text-lg font-bold tabular-nums mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data for selected filters.</div>;
}
