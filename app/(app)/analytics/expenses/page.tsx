import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { PageHelp } from "@/components/help/page-help";
import { SimpleBar, SimpleLine, SimplePie, StackedBar } from "@/components/analytics/charts";
import { requireProfile } from "@/lib/auth/require";
import { getExpenseAnalytics } from "@/lib/actions/analytics";
import { listActiveLocations } from "@/lib/actions/reference";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ExpenseAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;

  const [data, locations] = await Promise.all([
    getExpenseAnalytics({
      from: sp.from,
      to: sp.to,
      location_id: sp.location_id,
      category_id: sp.category_id,
      vendor_id: sp.vendor_id,
    }),
    listActiveLocations(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expense Analytics</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      <PageHelp id="analytics-expenses">
        <p>Where the money goes for the selected period:</p>
        <ul>
          <li><strong>By category</strong> — shows at a glance if one category (repair, utility, purchase) is eating most of the budget.</li>
          <li><strong>Top 10 vendors</strong> — your largest suppliers by spend. Helps identify where to negotiate.</li>
          <li><strong>Paid vs outstanding</strong> — how much of each month&apos;s expenses is still unpaid. Pair with the Outstanding report when managing what you owe.</li>
        </ul>
      </PageHelp>

      <AnalyticsFilters
        locations={locations}
        canFilterLocation={profile.role !== "manager"}
        exportHref="/api/export/expense-analytics"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total expenses" value={formatMoney(data.total_expenses)} />
        <Stat label="Largest category" value={data.largest_category ? `${data.largest_category.name} (${formatMoney(data.largest_category.total)})` : "—"} />
        <Stat label="Top vendor" value={data.top_vendor ? `${data.top_vendor.name} (${formatMoney(data.top_vendor.total)})` : "—"} />
        <Stat label="Outstanding payables" value={formatMoney(data.outstanding_payables)} accent={data.outstanding_payables > 0 ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Expenses by category</CardTitle></CardHeader>
          <CardContent>
            {data.by_category.length > 0 ? (
              <SimplePie data={data.by_category} nameKey="name" valueKey="total" money />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Expenses by location</CardTitle></CardHeader>
          <CardContent>
            {data.by_location.length > 0 ? (
              <SimpleBar data={data.by_location} xKey="name" yKey="total" money />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly expense trend</CardTitle></CardHeader>
          <CardContent>
            {data.monthly_trend.length > 0 ? (
              <SimpleLine data={data.monthly_trend} xKey="month" yKey="total" money />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top 10 vendors</CardTitle></CardHeader>
          <CardContent>
            {data.top_vendors.length > 0 ? (
              <SimpleBar data={data.top_vendors} xKey="name" yKey="total" horizontal money height={320} />
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Paid vs outstanding (monthly)</CardTitle></CardHeader>
          <CardContent>
            {data.paid_vs_outstanding.length > 0 ? (
              <StackedBar data={data.paid_vs_outstanding} xKey="month" keys={["paid", "outstanding"]} money />
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "warn" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold tabular-nums mt-1 ${accent === "warn" ? "text-amber-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data for selected filters.</div>;
}
