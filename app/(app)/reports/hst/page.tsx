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
import { requireProfile } from "@/lib/auth/require";
import { getHstSummary } from "@/lib/actions/reports";
import { listActiveLocations } from "@/lib/actions/reference";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function HstSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "owner" && profile.role !== "accountant") notFound();
  const sp = await searchParams;

  const [data, locations] = await Promise.all([
    getHstSummary({ from: sp.from, to: sp.to, location_id: sp.location_id }),
    listActiveLocations(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">HST Summary</h1>
        <p className="text-sm text-muted-foreground">{data.period_label}</p>
      </div>

      <PageHelp id="reports-hst">
        <p>Your HST remittance worksheet. For the selected period:</p>
        <ul>
          <li><strong>HST Collected</strong> — the 13% HST you charged customers on every sales invoice.</li>
          <li><strong>HST Paid</strong> — the 13% HST you paid to vendors on your expenses (input tax credits).</li>
          <li><strong>Net HST payable</strong> — what you owe CRA (collected minus paid). A negative number means CRA owes you.</li>
        </ul>
        <p>
          The monthly breakdown makes it easy to fill out your quarterly or annual return. Owner and accountant only.
        </p>
        <p>
          The default view covers the last month. Adjust the dates to match your filing period.
        </p>
      </PageHelp>

      <AnalyticsFilters
        locations={locations}
        canFilterLocation
        exportHref="/api/export/hst-summary"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="HST Collected (sales)" value={formatMoney(data.hst_collected)} accent="pos" />
        <Stat label="HST Paid (expenses)" value={formatMoney(data.hst_paid)} accent="neg" />
        <Stat
          label="Net HST payable"
          value={formatMoney(data.net_hst_payable)}
          accent={data.net_hst_payable >= 0 ? "warn" : "pos"}
          big
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 text-sm space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Sales total</span><span className="tabular-nums">{formatMoney(data.sales_total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expense total</span><span className="tabular-nums">{formatMoney(data.expense_total)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown */}
      <Card>
        <CardHeader><CardTitle>Monthly breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.by_month.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No HST activity for the selected period.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">HST Collected</TableHead>
                  <TableHead className="text-right">HST Paid</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_month.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(r.hst_collected)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(r.hst_paid)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.hst_collected - r.hst_paid)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(data.hst_collected)}</TableCell>
                  <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(data.hst_paid)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(data.net_hst_payable)}</TableCell>
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
                  <TableHead className="text-right">HST Collected</TableHead>
                  <TableHead className="text-right">HST Paid</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_location.map((r) => (
                  <TableRow key={r.location_name}>
                    <TableCell className="font-medium">{r.location_name}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{formatMoney(r.hst_collected)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{formatMoney(r.hst_paid)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.hst_collected - r.hst_paid)}</TableCell>
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
