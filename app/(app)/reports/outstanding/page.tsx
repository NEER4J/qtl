import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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
import { requireProfile } from "@/lib/auth/require";
import { getOutstandingInvoices } from "@/lib/actions/reports";
import { listActiveLocations } from "@/lib/actions/reference";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const BUCKET_COLORS: Record<string, string> = {
  current: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "1-30": "bg-blue-50 text-blue-700 border-blue-200",
  "31-60": "bg-amber-50 text-amber-700 border-amber-200",
  "61-90": "bg-orange-50 text-orange-700 border-orange-200",
  "90+": "bg-rose-50 text-rose-700 border-rose-200",
};

export default async function OutstandingReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;

  const [{ rows, total_outstanding, by_bucket }, locations] = await Promise.all([
    getOutstandingInvoices({ location_id: sp.location_id }),
    listActiveLocations(),
  ]);

  const buckets: (keyof typeof BUCKET_COLORS)[] = ["current", "1-30", "31-60", "61-90", "90+"];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outstanding Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} invoice{rows.length !== 1 ? "s" : ""} · {formatMoney(total_outstanding)} outstanding
        </p>
      </div>

      <AnalyticsFilters
        locations={locations}
        canFilterLocation={profile.role !== "manager"}
        exportHref="/api/export/outstanding"
      />

      {/* Aging buckets */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {buckets.map((b) => (
          <Card key={b}>
            <CardContent className="pt-6">
              <Badge variant="outline" className={`${BUCKET_COLORS[b]} text-xs mb-2`}>
                {b === "current" ? "Current" : `${b} days`}
              </Badge>
              <div className="text-xl font-bold tabular-nums">{formatMoney(by_bucket[b] ?? 0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All outstanding invoices</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No outstanding invoices. Nicely done.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/sales/${r.id}`} className="font-mono text-sm hover:underline">
                        #{r.invoice_no}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(r.job_date)}</TableCell>
                    <TableCell className="font-medium">{r.billing_name}</TableCell>
                    <TableCell className="text-sm">{r.location_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${BUCKET_COLORS[r.bucket]} text-xs`}>
                        {r.days_overdue}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.paid_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-rose-600">{formatMoney(r.outstanding)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t font-semibold">
                  <TableCell colSpan={7}>Total outstanding</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(total_outstanding)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
