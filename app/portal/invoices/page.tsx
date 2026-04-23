import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHelp } from "@/components/help/page-help";
import { StatusBadge } from "@/components/sales/status-badge";
import { listMyInvoices } from "@/lib/actions/portal";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PortalInvoicesPage() {
  const invoices = await listMyInvoices();

  const totalOutstanding = invoices.reduce((s, i) => s + Number(i.outstanding), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your invoices</h1>
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          {totalOutstanding > 0 && <> · <span className="text-rose-600 font-medium">{formatMoney(totalOutstanding)} outstanding</span></>}
        </p>
      </div>

      <PageHelp id="portal-invoices" defaultOpen>
        <p>
          Welcome to the Quick Truck Lube &amp; Oil customer portal. This page shows every invoice billed to your company across our three locations in Ayr, Fort Erie, and Napanee.
        </p>
        <ul>
          <li>Click any invoice to see the full details and download a PDF copy.</li>
          <li><strong>Status</strong>: green means paid in full, amber means partially paid, red means still owing.</li>
          <li>If an invoice is missing or something looks wrong, call your account contact at QTL.</li>
        </ul>
      </PageHelp>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No invoices on file.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{formatDate(i.job_date)}</TableCell>
                    <TableCell className="font-mono text-sm">#{i.invoice_no}</TableCell>
                    <TableCell className="text-sm">{i.location_name ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={i.payment_status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(i.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.outstanding > 0 ? (
                        <span className="text-rose-600 font-medium">{formatMoney(i.outstanding)}</span>
                      ) : (
                        formatMoney(0)
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/portal/invoices/${i.id}`} className="text-primary text-sm hover:underline">
                        View
                      </Link>
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
