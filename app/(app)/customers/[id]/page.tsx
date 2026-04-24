import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";

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
import { StatusBadge } from "@/components/sales/status-badge";
import { getCustomer, getCustomerSalesHistory } from "@/lib/actions/customers";
import { PageHelp } from "@/components/help/page-help";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, jobs] = await Promise.all([
    getCustomer(id),
    getCustomerSalesHistory(id),
  ]);
  if (!customer) notFound();

  const totalSpent = jobs.reduce((s, j) => s + j.total, 0);
  const totalOutstanding = jobs.reduce((s, j) => s + j.outstanding, 0);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/customers"><ChevronLeft className="size-4" /> Back to customers</Link>
          </Button>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.billing_name}</h1>
            {!customer.active && <Badge variant="secondary">Inactive</Badge>}
          </div>
          {customer.license_plates.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {customer.license_plates.map((p) => (
                <span key={p} className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{p}</span>
              ))}
            </div>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/export/customer-statement?customer_id=${customer.id}`} download>
            <Download className="size-4" /> Statement CSV
          </a>
        </Button>
      </div>

      <PageHelp id="customer-detail">
        <p>From this page you can:</p>
        <ul>
          <li><strong>Statement CSV</strong> — download a spreadsheet of every invoice this customer has ever had. Useful for sending to their accounts-payable team.</li>
          <li><strong>Job history</strong> — every job for this customer, with outstanding balances highlighted in red. Click any row to open the invoice.</li>
        </ul>
        <p>Nothing is ever permanently deleted — &quot;Deactivate&quot; just hides the customer; their history stays.</p>
      </PageHelp>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <Field label="Contact" value={customer.contact_no} />
            <Field label="Email" value={customer.email} />
            {customer.notes && <Field label="Notes" value={customer.notes} />}
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 md:col-span-2 gap-4">
          <Stat label="Total jobs" value={String(jobs.length)} />
          <Stat label="Total spent" value={formatMoney(totalSpent)} />
          <Stat label="Outstanding" value={formatMoney(totalOutstanding)} highlight={totalOutstanding > 0} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No jobs yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>{formatDate(j.job_date)}</TableCell>
                    <TableCell className="font-mono text-sm">#{j.invoice_no}</TableCell>
                    <TableCell><StatusBadge status={j.payment_status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(j.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {j.outstanding > 0 ? (
                        <span className="text-rose-600 font-medium">{formatMoney(j.outstanding)}</span>
                      ) : (
                        formatMoney(0)
                      )}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/sales/${j.id}`}>View</Link>
                      </Button>
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${highlight ? "text-rose-600" : ""}`}>{value}</div>
    </div>
  );
}
