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
import { requirePage } from "@/lib/auth/require";
import { getMhswSummary } from "@/lib/actions/mhsw-report";
import { listActiveLocations } from "@/lib/actions/reference";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function MhswSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePage("reports_mhsw");
  const sp = await searchParams;

  const [data, locations] = await Promise.all([
    getMhswSummary({ from: sp.from, to: sp.to, location_id: sp.location_id }),
    listActiveLocations(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">MHSW Summary</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      <PageHelp id="reports-mhsw">
        <p>MHSW works like HST: you pay it when you buy and charge it when you sell. For the selected period:</p>
        <ul>
          <li><strong>MHSW charged (sales)</strong>: the MHSW lines on sales invoices (the parts in the MHSW category, e.g. QTL1010 per filter and QTL1011 per litre), plus any MHSW built into a part&apos;s price.</li>
          <li><strong>MHSW paid (expenses)</strong>: the MHSW / unit column on vendor bills (the vendor&apos;s &quot;Environmental charge&quot; lines) times the quantity.</li>
          <li><strong>Net</strong>: charged minus paid.</li>
        </ul>
        <p>The default view covers the last month. Adjust the dates to match your filing period.</p>
      </PageHelp>

      <AnalyticsFilters locations={locations} canFilterLocation />

      {!data.paid_supported && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          MHSW paid on vendor bills is not recorded yet. It starts once the database update for the
          expense MHSW column is applied.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="MHSW charged (sales)" value={formatMoney(data.mhsw_charged)} accent="pos" />
        <Stat label="MHSW paid (expenses)" value={formatMoney(data.mhsw_paid)} accent="neg" />
        <Stat label="Net MHSW" value={formatMoney(data.net)} accent={data.net >= 0 ? "warn" : "pos"} big />
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.by_month.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No MHSW activity for the selected period.</div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">MHSW charged</TableHead>
                  <TableHead className="text-right">MHSW paid</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_month.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(r.charged)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(r.paid)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.charged - r.paid)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(data.mhsw_charged)}</TableCell>
                  <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(data.mhsw_paid)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(data.net)}</TableCell>
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
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">MHSW charged</TableHead>
                  <TableHead className="text-right">MHSW paid</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_location.map((r) => (
                  <TableRow key={r.location_name}>
                    <TableCell className="font-medium">{r.location_name}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(r.charged)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(r.paid)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.charged - r.paid)}</TableCell>
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

function Stat({ label, value, accent, big }: { label: string; value: string; accent?: "pos" | "neg" | "warn"; big?: boolean }) {
  const color =
    accent === "pos" ? "text-emerald-600" :
    accent === "neg" ? "text-rose-600" :
    accent === "warn" ? "text-amber-600" : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`${big ? "text-3xl" : "text-2xl"} font-bold tabular-nums mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
