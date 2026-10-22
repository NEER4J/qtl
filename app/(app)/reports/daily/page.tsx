import Link from "next/link";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PrintButton } from "@/components/pricing/print-button";
import { StatusBadge } from "@/components/sales/status-badge";
import { DailyReportFilters } from "./daily-report-filters";
import { DailyReportCharts } from "./daily-report-charts";
import { listLocations } from "@/lib/actions/locations";
import { getDailyJobReport } from "@/lib/actions/reports";
import { requirePage } from "@/lib/auth/require";
import { accessibleLocationIds, canChooseLocation } from "@/lib/auth/locations";
import { formatDate, formatMoney, formatTime, todayISO } from "@/lib/utils/format";
import { paymentModeLabel } from "@/lib/utils/payment-modes";

export const dynamic = "force-dynamic";

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requirePage("reports_daily");
  const sp = await searchParams;
  const date = sp.date ?? todayISO();

  // Anyone with more than one shop in reach gets the picker; a single-location
  // user is pinned to theirs. getDailyJobReport clamps whatever we pass to the
  // caller's allowed locations, so a hand-typed location_id can't widen this.
  const canPick = canChooseLocation(profile);
  const locationId = canPick ? (sp.location_id ?? null) : profile.location_id;

  const [report, locations] = await Promise.all([
    getDailyJobReport(date, locationId ?? null),
    listLocations(),
  ]);

  const filteredJobs = sp.customer_status
    ? report.jobs.filter((j) => j.customer_status === sp.customer_status)
    : report.jobs;

  const exportParams = new URLSearchParams({ date });
  if (locationId) exportParams.set("location_id", locationId);
  if (sp.customer_status) exportParams.set("customer_status", sp.customer_status);
  const locationName = locationId
    ? (locations.find((l) => l.id === locationId)?.name ?? "")
    : "All locations";

  const sum = (pick: (j: (typeof filteredJobs)[number]) => number) =>
    filteredJobs.reduce((s, j) => s + pick(j), 0);
  // Tendered on today's jobs beyond what they owed (the excess is store credit).
  const overpaid =
    report.by_payment_method.reduce((s, m) => s + m.jobs_amount, 0) - report.totals.paid;

  return (
    <div className="flex flex-col gap-6 print:gap-3">
      {/* Landscape: the jobs table is wide. Charts and controls stay on screen. */}
      <style>{"@media print { @page { size: landscape; margin: 0.35in; } }"}</style>

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily job report</h1>
          <p className="text-sm text-muted-foreground">
            The whole day — every job with its payments, the payments taken today, parts used.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DailyReportFilters
            initial={{
              date,
              location_id: locationId ?? "",
              customer_status: sp.customer_status ?? "",
            }}
            locations={locations.filter(
              (l) =>
                l.active &&
                (accessibleLocationIds(profile)?.includes(l.id) ?? true),
            )}
            locationLocked={!canPick}
          />
          <div className="flex gap-2">
            <PrintButton />
            <Button asChild size="sm" variant="outline">
              <a href={`/api/export/daily-report?${exportParams.toString()}`} download>
                <Download className="size-4" /> CSV
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Print header — only on paper. */}
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">
          Daily report — {formatDate(date)} · {locationName}
          {sp.customer_status ? ` · ${sp.customer_status} customers` : ""}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8 print:grid-cols-8 print:gap-2">
        <Stat label="Jobs" value={String(report.totals.job_count)} />
        <Stat label="Sub Total" value={formatMoney(report.totals.sub_total)} />
        <Stat label="HST" value={formatMoney(report.totals.hst)} />
        <Stat label="Total" value={formatMoney(report.totals.total)} />
        <Stat label="Paid" value={formatMoney(report.totals.paid)} />
        <Stat label="Store credit used" value={formatMoney(report.totals.credit_applied)} />
        <Stat
          label="Outstanding"
          value={formatMoney(report.totals.outstanding)}
          highlight={report.totals.outstanding > 0}
          hint={
            report.totals.refunds_due > 0
              ? `${formatMoney(report.totals.refunds_due)} to refund on returns`
              : undefined
          }
        />
        <Stat
          label="Received today"
          value={formatMoney(report.totals.received)}
          hint={
            report.totals.received_older > 0
              ? `${formatMoney(report.totals.received_older)} on older invoices`
              : `${report.totals.received_count} payment${report.totals.received_count === 1 ? "" : "s"}`
          }
        />
      </div>

      <div className="print:hidden">
        <DailyReportCharts report={report} />
      </div>

      <Card className="print:break-inside-avoid">
        <CardHeader>
          <CardTitle>By payment method</CardTitle>
          <p className="text-sm text-muted-foreground">
            <strong>Today&apos;s jobs</strong> — how the day&apos;s invoices were paid, whenever
            the money came in. <strong>Received today</strong> — every payment dated today, on any
            invoice: what should be in the drawer and the card terminal.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Today&apos;s jobs</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Received today</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.by_payment_method.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No payments.
                  </TableCell>
                </TableRow>
              ) : (
                report.by_payment_method.map((m) => (
                  <TableRow key={m.mode ?? "none"}>
                    <TableCell className="font-medium">
                      {m.mode ? paymentModeLabel(m.mode) : "Not recorded"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.jobs_count || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.jobs_count ? formatMoney(m.jobs_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.received_count || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.received_count ? formatMoney(m.received_amount) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {overpaid > 0.005 && (
                <TableRow className="text-muted-foreground">
                  <TableCell>Paid beyond the invoice (store credit)</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatMoney(-overpaid)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
              {report.totals.credit_applied > 0 && (
                <TableRow className="text-muted-foreground">
                  <TableCell>Store credit applied</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(report.totals.credit_applied)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
              <TableRow className="text-muted-foreground">
                <TableCell>Still owing on today&apos;s jobs</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatMoney(report.totals.outstanding)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell />
                {/* = tendered − overpaid + credit + owing = the day's Total. */}
                <TableCell className="text-right tabular-nums">
                  {formatMoney(report.totals.total)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {report.totals.received_count}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(report.totals.received)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

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
            <div className="overflow-x-auto print:overflow-visible">
              <Table className="text-xs print:text-[9px]">
                <TableHeader className="bg-background">
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Loc</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Odometer</TableHead>
                    <TableHead>Techs / advisor</TableHead>
                    <TableHead className="text-right">Sub total</TableHead>
                    <TableHead className="text-right">HST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Paid by</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Owing</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="tabular-nums">
                        {j.start_time?.slice(0, 5) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/sales/${j.id}`} className="font-mono hover:underline">
                          #{j.invoice_no}
                        </Link>
                      </TableCell>
                      <TableCell>{j.location_code ?? "—"}</TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          {j.customer_id ? (
                            <Link href={`/customers/${j.customer_id}`} className="truncate hover:underline">
                              {j.customer_name ?? "—"}
                            </Link>
                          ) : (
                            <span className="truncate">{j.customer_name ?? "—"}</span>
                          )}
                          {j.customer_status && (
                            <Badge variant="outline" className="px-1 py-0 text-[10px] capitalize print:hidden">
                              {j.customer_status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {j.plate && j.vehicle_id && j.customer_id ? (
                          <Link
                            href={`/customers/${j.customer_id}/vehicles/${j.vehicle_id}/history`}
                            className="hover:underline"
                            title={j.vehicle_label ?? undefined}
                          >
                            {j.plate}
                          </Link>
                        ) : (
                          (j.plate ?? "—")
                        )}
                        {j.unit_no && (
                          <div className="text-[10px] text-muted-foreground">Unit {j.unit_no}</div>
                        )}
                      </TableCell>
                      <TableCell title={j.service_name ?? undefined}>{j.service_code ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {j.odometer != null ? j.odometer.toLocaleString("en-CA") : "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="truncate">
                          {[j.upper_tech, j.lower_tech].filter(Boolean).join(" / ") || "—"}
                        </div>
                        {j.advisor_name && (
                          <div className="truncate text-[10px] text-muted-foreground">
                            Adv: {j.advisor_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(j.sub_total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(j.hst)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(j.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(j.paid_amount)}</TableCell>
                      <TableCell>
                        {j.payments.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          j.payments.map((p) => (
                            <div key={p.mode ?? "none"} className="whitespace-nowrap">
                              {paymentModeLabel(p.mode)}{" "}
                              <span className="tabular-nums text-muted-foreground">
                                {formatMoney(p.amount)}
                              </span>
                            </div>
                          ))
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {j.credit_applied > 0 ? formatMoney(j.credit_applied) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {j.outstanding > 0 ? (
                          <span className="font-medium text-rose-600">{formatMoney(j.outstanding)}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={j.payment_status as "paid" | "partial" | "outstanding"}
                          className="px-1.5 py-0 text-[10px]"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={8}>Total ({filteredJobs.length} jobs)</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(sum((j) => j.sub_total))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(sum((j) => j.hst))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(sum((j) => j.total))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(sum((j) => j.paid_amount))}</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{formatMoney(sum((j) => j.credit_applied))}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(sum((j) => Math.max(0, j.outstanding)))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Payments received ({report.payments_received.length}) ·{" "}
            {formatMoney(report.totals.received)}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Every payment dated {formatDate(date)}, whatever the invoice date. Payments on earlier
            invoices are flagged.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {report.payments_received.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No payments recorded for this date.
            </div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <Table className="text-xs print:text-[9px]">
                <TableHeader className="bg-background">
                  <TableRow>
                    <TableHead>Entered</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Loc</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.payments_received.map((p) => (
                    <TableRow key={p.key}>
                      <TableCell className="tabular-nums">
                        {p.created_at ? formatTime(p.created_at) : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/sales/${p.job_id}`} className="font-mono hover:underline">
                          #{p.invoice_no}
                        </Link>
                        {p.older_invoice && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 border-amber-300 bg-amber-50 px-1 py-0 text-[10px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                          >
                            Invoice of {formatDate(p.job_date)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{p.location_code ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {p.customer_id ? (
                          <Link href={`/customers/${p.customer_id}`} className="hover:underline">
                            {p.customer_name ?? "—"}
                          </Link>
                        ) : (
                          (p.customer_name ?? "—")
                        )}
                      </TableCell>
                      <TableCell>{paymentModeLabel(p.mode)}</TableCell>
                      <TableCell className="font-mono">{p.reference ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(p.amount)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {p.legacy ? "Recorded on the invoice (no payment entry)" : (p.notes ?? "")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6}>Total received</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(report.totals.received)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
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
            <Table className="print:text-[9px]">
              <TableHeader className="bg-background">
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
  hint,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-3 print:p-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums print:text-sm ${highlight ? "text-rose-600" : ""}`}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
