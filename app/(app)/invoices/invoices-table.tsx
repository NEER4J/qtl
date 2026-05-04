import Link from "next/link";
import { FileCheck2, FileX2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/sales/status-badge";
import { DownloadInvoiceButton } from "@/components/sales/download-invoice-button";
import type { SalesJobRow } from "@/lib/actions/sales";
import { formatDate, formatMoney } from "@/lib/utils/format";

import { SalesPagination } from "../sales/sales-pagination";

export function InvoicesTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: SalesJobRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell w-16">Loc</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right hidden md:table-cell">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-16 text-center">PDF</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 px-6 text-center text-muted-foreground">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">No invoices to show.</p>
                    <p className="text-sm">
                      Either nothing matches your filters, or no jobs have been recorded yet.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.job_date)}</TableCell>
                  <TableCell>
                    <Link className="font-mono hover:underline" href={`/sales/${r.id}`}>
                      {r.invoice_no}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{r.billing_name}</TableCell>
                  <TableCell className="hidden md:table-cell">{r.location_code ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                  <TableCell className="text-right tabular-nums hidden md:table-cell">
                    {formatMoney(r.paid_amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.outstanding)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.payment_status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {r.invoice_pdf_path ? (
                      <FileCheck2 className="size-4 text-emerald-600 inline" aria-label="PDF on file" />
                    ) : (
                      <FileX2 className="size-4 text-muted-foreground inline" aria-label="No PDF" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DownloadInvoiceButton jobId={r.id} invoiceNo={r.invoice_no} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && <SalesPagination page={page} pageCount={pageCount} basePath="/invoices" />}
    </div>
  );
}
