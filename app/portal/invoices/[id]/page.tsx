import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/sales/status-badge";
import { DownloadInvoiceButton } from "@/components/sales/download-invoice-button";
import { getMyInvoice } from "@/lib/actions/portal";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PortalInvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getMyInvoice(id);
  if (!invoice) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/portal/invoices"><ChevronLeft className="size-4" /> Back</Link>
          </Button>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold tracking-tight font-mono">#{invoice.invoice_no}</h1>
            <StatusBadge status={invoice.payment_status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(invoice.job_date)} · {invoice.location_name ?? ""}
          </p>
        </div>
        <DownloadInvoiceButton jobId={invoice.id} invoiceNo={invoice.invoice_no} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Job details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Billing name" value={invoice.billing_name} />
            <Field label="License plate" value={invoice.license_plate ?? "—"} mono />
            <Field label="Odometer" value={invoice.odometer != null ? `${invoice.odometer.toLocaleString()} km` : "—"} />
            <Field label="Carrier" value={invoice.carrier_name ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Amounts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Sub Total" value={formatMoney(invoice.sub_total)} />
            <Row label="HST" value={formatMoney(invoice.hst)} />
            <Row label="Total" value={formatMoney(invoice.total)} bold />
            <div className="border-t my-2" />
            <Row label="Paid" value={formatMoney(invoice.paid_amount)} />
            <Row label="Outstanding" value={formatMoney(invoice.outstanding)} bold highlight={invoice.outstanding > 0} />
          </CardContent>
        </Card>
      </div>

      {invoice.comments && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{invoice.comments}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : undefined}>{value}</div>
    </div>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""} ${highlight ? "text-rose-600" : ""}`}>{value}</span>
    </div>
  );
}
