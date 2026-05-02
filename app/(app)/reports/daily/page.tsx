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
import { StatusBadge } from "@/components/sales/status-badge";
import { DailyReportFilters } from "./daily-report-filters";
import { DailyReportCharts } from "./daily-report-charts";
import { listLocations } from "@/lib/actions/locations";
import { getDailyJobReport } from "@/lib/actions/reports";
import { requireProfile } from "@/lib/auth/require";
import { formatMoney, todayISO } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const date = sp.date ?? todayISO();

  // Manager defaults to own location; owner/accountant can pick.
  const isLocationScoped = profile.role === "manager" || profile.role === "staff";
  const requestedLoc = sp.location_id ?? null;
  const locationId = isLocationScoped ? profile.location_id : requestedLoc;

  const [report, locations] = await Promise.all([
    getDailyJobReport(date, locationId ?? null),
    listLocations(),
  ]);

  const filteredJobs = sp.customer_status
    ? report.jobs.filter((j) => j.customer_status === sp.customer_status)
    : report.jobs;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily job report</h1>
          <p className="text-sm text-muted-foreground">
            Single-day snapshot — jobs, parts used, revenue by hour, customer mix.
          </p>
        </div>
        <DailyReportFilters
          initial={{
            date,
            location_id: locationId ?? "",
            customer_status: sp.customer_status ?? "",
          }}
          locations={locations.filter((l) => l.active)}
          locationLocked={isLocationScoped}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Stat label="Jobs" value={String(report.totals.job_count)} />
        <Stat label="Sub Total" value={formatMoney(report.totals.sub_total)} />
        <Stat label="HST" value={formatMoney(report.totals.hst)} />
        <Stat label="Total" value={formatMoney(report.totals.total)} />
        <Stat label="Paid" value={formatMoney(report.totals.paid)} />
        <Stat
          label="Outstanding"
          value={formatMoney(report.totals.outstanding)}
          highlight={report.totals.outstanding > 0}
        />
      </div>

      <DailyReportCharts report={report} />

      <Card>
        <CardHeader>
          <CardTitle>Jobs ({filteredJobs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredJobs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No jobs match the current filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Loc</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="tabular-nums">
                      {j.job_time?.slice(0, 5) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/sales/${j.id}`} className="font-mono text-sm hover:underline">
                        #{j.invoice_no}
                      </Link>
                    </TableCell>
                    <TableCell>{j.location_code ?? "—"}</TableCell>
                    <TableCell>{j.service_code ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{j.customer_name ?? "—"}</span>
                        {j.customer_status && (
                          <Badge variant="outline" className="capitalize">
                            {j.customer_status}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{j.vehicle_label ?? "—"}</TableCell>
                    <TableCell>{j.advisor_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(j.total)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={j.payment_status as "paid" | "partial" | "outstanding"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parts used ({report.parts_used.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.parts_used.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No parts logged.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part #</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.parts_used.map((p, idx) => (
                  <TableRow key={p.part_id ?? `desc-${idx}`}>
                    <TableCell className="font-mono">{p.part_number ?? "—"}</TableCell>
                    <TableCell>{p.brand ?? "—"}</TableCell>
                    <TableCell>{p.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.qty_total}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.revenue)}
                    </TableCell>
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

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${highlight ? "text-rose-600" : ""}`}>
        {value}
      </div>
    </div>
  );
}
