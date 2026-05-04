import Link from "next/link";
import { AlertTriangle } from "lucide-react";

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
import { SimpleBar, SimplePie, StackedBar } from "@/components/analytics/charts";
import { requireProfile } from "@/lib/auth/require";
import { getProductsAnalytics } from "@/lib/actions/analytics";
import { listLowMarginParts } from "@/lib/actions/pricing";
import { listActiveLocations } from "@/lib/actions/reference";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ProductsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;

  const [data, locations, lowMargin] = await Promise.all([
    getProductsAnalytics({
      from: sp.from,
      to: sp.to,
      location_id: sp.location_id,
    }),
    listActiveLocations(),
    profile.role === "owner" ? listLowMarginParts() : Promise.resolve(null),
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

      <AnalyticsFilters
        locations={locations}
        canFilterLocation={profile.role !== "manager"}
        exportHref="/api/export/products-analytics"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Total jobs" value={data.total_jobs.toLocaleString()} />
        <Stat label="Most performed" value={data.most_performed ?? "—"} />
        <Stat label="Highest revenue" value={data.highest_revenue ?? "—"} />
      </div>

      {lowMargin && lowMargin.threshold_pct > 0 && lowMargin.parts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <CardTitle className="text-base">
              {lowMargin.parts.length} part{lowMargin.parts.length === 1 ? "" : "s"} below margin threshold ({lowMargin.threshold_pct}%)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">List</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowMargin.parts.slice(0, 20).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link className="font-mono hover:underline" href={`/settings/pricing/parts?focus=${p.id}`}>
                        {p.part_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{p.brand}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.list_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.margin_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-amber-700">{p.margin_pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {lowMargin.parts.length > 20 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">
                      …and {lowMargin.parts.length - 20} more.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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

      {data.oil_change_total > 0 && (
        <>
          <div className="flex items-baseline gap-2 mt-4">
            <h2 className="text-lg font-semibold">Oil-change catalog breakdown</h2>
            <span className="text-xs text-muted-foreground">
              {data.oil_change_linked} of {data.oil_change_total} oil-change jobs in this period have engine + oil recorded.
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Revenue by oil grade</CardTitle></CardHeader>
              <CardContent>
                {data.by_oil_grade.length > 0 ? (
                  <SimplePie data={data.by_oil_grade} nameKey="code" valueKey="total" money />
                ) : <EmptyChart />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Bulk vs Imperial Gallon</CardTitle></CardHeader>
              <CardContent>
                {data.by_container.length > 0 ? (
                  <SimplePie data={data.by_container} nameKey="container" valueKey="count" />
                ) : <EmptyChart />}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Top engines (by job count)</CardTitle></CardHeader>
              <CardContent>
                {data.by_engine.length > 0 ? (
                  <SimpleBar data={data.by_engine} xKey="name" yKey="count" horizontal />
                ) : <EmptyChart />}
              </CardContent>
            </Card>
          </div>
        </>
      )}
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
