import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CreditCard, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddPaymentDialog } from "@/components/sales/add-payment-dialog";
import { DownloadInvoiceButton } from "@/components/sales/download-invoice-button";
import { StatusBadge } from "@/components/sales/status-badge";
import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";
import { getSalesJob } from "@/lib/actions/sales";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { buildDisplayRows } from "@/lib/utils/sales-display";

export const dynamic = "force-dynamic";

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  cheque: "Cheque",
  debit: "Debit",
  visa: "Visa",
  mastercard: "Mastercard",
  etransfer: "E-Transfer",
  credit_card: "Credit Card",
  oc: "Outstanding",
};

export default async function SalesJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const job = await getSalesJob(id);
  if (!job) notFound();

  const canEdit =
    (profile.role === "owner" || profile.role === "co_owner") ||
    (profile.role === "manager" && profile.location_id === job.location_id);

  const canAddPayment =
    profile.role !== "employee" &&
    ((profile.role === "owner" || profile.role === "co_owner") ||
      profile.role === "accountant" ||
      profile.location_id === job.location_id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/sales">
              <ChevronLeft className="size-4" /> Back to sales
            </Link>
          </Button>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold tracking-tight font-mono">
              #{job.invoice_no}
            </h1>
            <StatusBadge status={job.payment_status} />
            {job.deactivated_at && <Badge variant="secondary">Deactivated</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(job.job_date)} · {job.location_name} · {job.service_type_name}
          </p>
        </div>
        <div className="flex gap-2">
          <DownloadInvoiceButton jobId={job.id} invoiceNo={job.invoice_no} />
          {canEdit && !job.deactivated_at && (
            <Button asChild variant="outline">
              <Link href={`/sales/${job.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <PageHelp id="sales-detail">
        <p>The full invoice. From here you can:</p>
        <ul>
          <li><strong>Download PDF</strong> — a branded invoice PDF you can email or print for the customer.</li>
          <li><strong>Edit</strong> — owners, and managers at the same shop, can make changes. Every edit is recorded in the audit log so you know who changed what.</li>
          <li><strong>Record payment</strong> — appears when there&apos;s an unpaid balance. You can add partial payments over time; the status moves from Outstanding to Partial to Paid automatically.</li>
        </ul>
        <p>
          Staff see a read-only version. Deactivated invoices are tagged and hidden from lists and reports, but kept in the system for your records.
        </p>
      </PageHelp>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Billing name" value={job.billing_name} />
            <Field label="License plate" value={job.license_plate} mono />
            <Field label="Contact" value={job.contact_no} />
            <Field label="Email" value={job.email} />
            <Field label="Odometer" value={job.odometer?.toLocaleString() ?? null} />
            <Field label="Carrier" value={job.carrier_name} />
            {job.free_grease_applied && (
              <Field label="Free grease" value="Applied" />
            )}
            {!job.free_grease_applied && job.free_grease_override_reason && (
              <Field label="Grease override" value={job.free_grease_override_reason} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Sub Total" value={formatMoney(job.sub_total)} />
            <Row label="HST" value={formatMoney(job.hst)} />
            <Row label="Total" value={formatMoney(job.total)} bold />
            <div className="border-t my-2" />
            <Row label="Paid" value={formatMoney(job.paid_amount)} />
            <Row label="Outstanding" value={formatMoney(job.outstanding)} bold />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Bay" value={job.bay_no != null ? String(job.bay_no) : null} />
          <Field label="Start time" value={job.start_time ? job.start_time.slice(0, 5) : null} />
          <Field label="End time" value={job.end_time ? job.end_time.slice(0, 5) : null} />
          <Field
            label="Duration"
            value={job.duration_minutes != null ? formatDurationMinutes(job.duration_minutes) : null}
          />
          <Field label="Advisor" value={job.advisor_name} />
          <Field label="Upper tech" value={job.upper_tech} />
          <Field label="Lower tech" value={job.lower_tech} />
          <Field label="Batch" value={job.batch_id} mono />
          <Field
            label="Payment mode"
            value={job.payment_mode ? PAYMENT_MODE_LABELS[job.payment_mode] : null}
          />
        </CardContent>
        {job.comments && (
          <CardContent className="border-t pt-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Notes</div>
            <p className="text-sm whitespace-pre-wrap">{job.comments}</p>
          </CardContent>
        )}
      </Card>

      {job.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-right">Qty</TableHead>
                  <TableHead className="w-32 text-right">Unit price</TableHead>
                  <TableHead className="w-24 text-right">MHSW</TableHead>
                  <TableHead className="w-32 text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildDisplayRows(
                  job.items,
                  (it) => Number(it.line_total ?? 0),
                  (it) => it.is_taxable === true,
                  (it) => it.package_label ?? "Package",
                ).map((row) => {
                  if (row.type === "package") {
                    const mergedSaved = row.items.reduce(
                      (s, m) =>
                        s +
                        (m.merged_unit_price != null
                          ? Number(m.merged_unit_price) * Number(m.quantity)
                          : 0),
                      0,
                    );
                    return (
                      <Fragment key={row.key}>
                        <TableRow>
                          <TableCell>
                            <div className="font-medium">{row.label}</div>
                            <div className="text-xs text-muted-foreground">
                              Package · {row.items.length} item
                              {row.items.length === 1 ? "" : "s"}
                              {mergedSaved > 0 &&
                                ` · merged, saved ${formatMoney(mergedSaved)}`}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            1
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            —
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            —
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatMoney(row.total)}
                          </TableCell>
                        </TableRow>
                        {row.items.map((m) => {
                          const isMerged = m.merged_unit_price != null;
                          return (
                            <TableRow key={m.id} className="border-0">
                              <TableCell className="py-1 pl-8 text-sm text-muted-foreground">
                                {m.description}
                                {isMerged && (
                                  <span className="ml-1 text-xs text-amber-700 dark:text-amber-500">
                                    · merged (already on the job)
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="py-1 text-right tabular-nums text-muted-foreground">
                                {Number(m.quantity)}
                              </TableCell>
                              <TableCell className="py-1 text-right text-xs uppercase text-muted-foreground">
                                {isMerged ? (
                                  <span className="line-through normal-case">
                                    {formatMoney(Number(m.merged_unit_price))}
                                  </span>
                                ) : (
                                  "Included"
                                )}
                              </TableCell>
                              <TableCell className="py-1" />
                              <TableCell className="py-1" />
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    );
                  }
                  const it = row.item;
                  const cs = it.is_customer_supplied === true;
                  const wouldHaveCharged =
                    Math.round(Number(it.quantity) * Number(it.unit_price) * 100) / 100;
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <div className="font-medium">{it.description}</div>
                        {it.part_id && (
                          <div className="text-xs text-muted-foreground">
                            Catalog: {it.part_brand} {it.part_number}
                          </div>
                        )}
                        {cs && (
                          <div className="text-xs text-emerald-600">
                            customer supplied — saved {formatMoney(wouldHaveCharged)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(it.quantity)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${cs ? "line-through text-muted-foreground" : ""}`}>
                        {formatMoney(it.unit_price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {Number(it.mhsw_unit) > 0 ? formatMoney(Number(it.mhsw_unit)) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(it.line_total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment history</CardTitle>
          {canAddPayment && job.outstanding > 0 && !job.deactivated_at && (
            <AddPaymentDialog salesJobId={job.id} outstanding={job.outstanding}>
              <Button size="sm">
                <CreditCard className="size-4" /> Record payment
              </Button>
            </AddPaymentDialog>
          )}
        </CardHeader>
        <CardContent>
          {job.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paid_on)}</TableCell>
                    <TableCell>{PAYMENT_MODE_LABELS[p.mode] ?? p.mode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.transaction_id ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.notes ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.amount)}
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

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : undefined}>{value || "—"}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
