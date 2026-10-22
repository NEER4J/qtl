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
import { ReversePaymentButton } from "@/components/sales/reverse-payment-button";
import { InvoiceActions } from "@/components/sales/invoice-actions";
import { StatusBadge } from "@/components/sales/status-badge";
import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";
import { getSalesJob } from "@/lib/actions/sales";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { OIL_TIER_GROUP, buildDisplayRows, foldOilTier } from "@/lib/utils/sales-display";
import { canAccessLocation } from "@/lib/auth/locations";
import { PAYMENT_MODE_LABELS, formatCardOnFile, isCardMode } from "@/lib/utils/payment-modes";
import { canUpdatePage } from "@/lib/permissions/check";

export const dynamic = "force-dynamic";

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

    (profile.role === "owner" ||
    profile.role === "co_owner" ||
    (["manager", "supervisor", "staff", "technician"].includes(profile.role) &&
      canAccessLocation(profile, job.location_id))) &&

    canUpdatePage(profile, "sales");

  const canAddPayment =

    (profile.role !== "employee" &&
    ((profile.role === "owner" || profile.role === "co_owner") ||
      profile.role === "accountant" ||
      canAccessLocation(profile, job.location_id))) &&

    canUpdatePage(profile, "sales");

  // The customer's card on file, shown against card payments.
  const cardOnFile = formatCardOnFile(job.customer_card_number, job.customer_card_expiry);

  // Reversing a payment re-opens the balance — owner / co_owner only (RLS 0153).
  const canReversePayment =
    ((profile.role === "owner" || profile.role === "co_owner") && !job.deactivated_at) &&
    canUpdatePage(profile, "sales");

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
          {job.updated_at && (
            <p className="text-xs text-muted-foreground">
              Last edited{" "}
              {new Date(job.updated_at).toLocaleString("en-CA", {
                timeZone: "America/Toronto",
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {job.updated_by_name ? ` by ${job.updated_by_name}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <InvoiceActions
            jobId={job.id}
            invoiceNo={job.invoice_no}
            customerEmail={job.email}
            billingName={job.billing_name}
            jobDate={job.job_date}
            total={job.total}
            shopName={[job.location_invoice_name || "Quick Truck Lube", job.location_name].filter(Boolean).join(" ")}
          />
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
          <li><strong>Print</strong> / <strong>Download PDF</strong> — the branded invoice, printed straight away or saved as a file.</li>
          <li><strong>Email</strong> — opens your email app with the invoice message written and a 30-day link to the PDF. Send it to the customer&apos;s email or type any other address.</li>
          <li><strong>Edit</strong> — owners, and managers / supervisors / staff at the same shop, can make changes. Every edit is recorded in the audit log so you know who changed what.</li>
          <li><strong>Record payment</strong> — appears when there&apos;s an unpaid balance. You can add partial payments over time; the status moves from Outstanding to Partial to Paid automatically.</li>
          <li><strong>Reverse</strong> — owners can take back a payment (a bounced cheque, or one posted to the wrong invoice). The invoice goes back to Outstanding or Partial; the reversal is kept in the audit log.</li>
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
            <Field
              label="Billing name"
              value={job.billing_name}
              href={job.customer_id ? `/customers/${job.customer_id}` : undefined}
            />
            <Field
              label="License plate"
              value={job.license_plate}
              mono
              href={
                job.customer_id && job.vehicle_id
                  ? `/customers/${job.customer_id}/vehicles/${job.vehicle_id}/history`
                  : undefined
              }
            />
            <Field label="Contact" value={job.contact_no} />
            <Field label="Email" value={job.email} />
          <Field label="Odometer" value={job.odometer?.toLocaleString() ?? null} />
          <Field label="Carrier" value={job.carrier_name} />
          {job.credited_from_invoice_no && (
            <Field
              label="Credit against"
              value={job.credited_from_invoice_no}
              mono
              href={job.credited_from_job_id ? `/sales/${job.credited_from_job_id}` : undefined}
            />
          )}
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
            {(job.credit_applied ?? 0) > 0 && (
              <Row label="Store credit applied" value={formatMoney(job.credit_applied ?? 0)} />
            )}
            <Row label="Paid" value={formatMoney(job.paid_amount)} />
            <Row
              label="Outstanding"
              value={formatMoney(job.outstanding)}
              bold
            />
            {job.outstanding < -0.005 && (
              <p className="text-xs text-emerald-600">
                Customer has store credit from this invoice.
              </p>
            )}
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
            value={job.payment_mode ? PAYMENT_MODE_LABELS[job.payment_mode] ?? job.payment_mode : null}
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
                  // An oil and its tier premium show as one line.
                  foldOilTier(job.items),
                  (it) => Number(it.line_total ?? 0),
                  (it) => it.is_taxable === true,
                  (it) => it.package_label ?? "Package",
                ).map((row) => {
                  if (row.type === "package") {
                    const oilWithTier = row.key.startsWith(OIL_TIER_GROUP);
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
                              {oilWithTier ? (
                                "Oil with its volume tier premium"
                              ) : (
                                <>
                                  Package · {row.items.length} item
                                  {row.items.length === 1 ? "" : "s"}
                                  {mergedSaved > 0 &&
                                    ` · merged, saved ${formatMoney(mergedSaved)}`}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {oilWithTier ? Number(row.items[0]!.quantity) : 1}
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
                        {formatMoney(Number(it.line_total))}
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
                  {canReversePayment && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paid_on)}</TableCell>
                    <TableCell>
                      {PAYMENT_MODE_LABELS[p.mode] ?? p.mode}
                      {isCardMode(p.mode) && cardOnFile && (
                        <div className="font-mono text-xs text-muted-foreground">{cardOnFile}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.transaction_id ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.notes ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.amount)}
                    </TableCell>
                    {canReversePayment && (
                      <TableCell className="text-right">
                        <ReversePaymentButton
                          paymentId={p.id}
                          label={`The ${formatMoney(p.amount)} ${PAYMENT_MODE_LABELS[p.mode] ?? p.mode} payment${p.transaction_id ? ` (${p.transaction_id})` : ""}`}
                        />
                      </TableCell>
                    )}
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
  href,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  /** Opens the record the value refers to (customer, vehicle, invoice). */
  href?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : undefined}>
        {value && href ? (
          <Link href={href} className="underline-offset-2 hover:underline">
            {value}
          </Link>
        ) : (
          value || "—"
        )}
      </div>
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
