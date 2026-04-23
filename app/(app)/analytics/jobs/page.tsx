import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { SimpleBar, SimpleLine } from "@/components/analytics/charts";
import { requireProfile } from "@/lib/auth/require";
import { getJobsAnalytics } from "@/lib/actions/analytics";
import { listActiveLocations } from "@/lib/actions/reference";

export const dynamic = "force-dynamic";

export default async function JobsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;

  const [data, locations] = await Promise.all([
    getJobsAnalytics({
      from: sp.from,
      to: sp.to,
      location_id: sp.location_id,
      service_type_id: sp.service_type_id,
      bay_no: sp.bay_no,
    }),
    listActiveLocations(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Duration Analytics</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      <AnalyticsFilters
        locations={locations}
        canFilterLocation={profile.role !== "manager"}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total jobs" value={data.total_jobs.toLocaleString()} />
        <Stat label="Avg duration" value={`${data.avg_duration_minutes.toFixed(0)} min`} />
        <Stat label="Fastest bay" value={data.fastest_bay ? `#${data.fastest_bay.bay_no} (${data.fastest_bay.avg_minutes.toFixed(0)}m)` : "—"} />
        <Stat label="Busiest hour" value={data.busiest_hour && data.busiest_hour.count > 0 ? `${data.busiest_hour.hour}:00` : "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Avg duration by service</CardTitle></CardHeader>
          <CardContent>
            {data.by_service_type.length > 0 ? (
              <SimpleBar data={data.by_service_type.map((s) => ({ ...s, label: `${s.code} ${s.name}` }))} xKey="label" yKey="avg_minutes" horizontal />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Avg duration by bay</CardTitle></CardHeader>
          <CardContent>
            {data.by_bay.length > 0 ? (
              <SimpleBar data={data.by_bay.map((b) => ({ ...b, label: `Bay ${b.bay_no}` }))} xKey="label" yKey="avg_minutes" horizontal />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Jobs per hour of day</CardTitle></CardHeader>
          <CardContent>
            <SimpleBar data={data.by_hour} xKey="hour" yKey="count" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Jobs per day of week</CardTitle></CardHeader>
          <CardContent>
            <SimpleBar data={data.by_dow} xKey="dow" yKey="count" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Job volume over time</CardTitle></CardHeader>
          <CardContent>
            {data.volume_trend.length > 0 ? (
              <SimpleLine data={data.volume_trend} xKey="day" yKey="count" />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Duration distribution</CardTitle></CardHeader>
          <CardContent>
            <SimpleBar data={data.duration_buckets} xKey="bucket" yKey="count" />
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
