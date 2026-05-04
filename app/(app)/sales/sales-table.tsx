import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/sales/status-badge";
import type { SalesJobRow } from "@/lib/actions/sales";
import { formatDate, formatMoney } from "@/lib/utils/format";

import { SalesPagination } from "./sales-pagination";

export function SalesTable({
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
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Plate</TableHead>
              <TableHead className="hidden md:table-cell w-16">Svc</TableHead>
              <TableHead className="hidden md:table-cell w-16">Loc</TableHead>
              <TableHead className="hidden md:table-cell w-12">Bay</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right hidden md:table-cell">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 px-6 text-center text-muted-foreground">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">No jobs to show.</p>
                    <p className="text-sm">
                      Either nothing matches your current filters, or no jobs have been recorded yet. Use <strong>New job</strong> to add your first one, or clear the filters above to see everything.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer">
                  <TableCell>{formatDate(r.job_date)}</TableCell>
                  <TableCell>
                    <Link className="font-mono hover:underline" href={`/sales/${r.id}`}>
                      {r.invoice_no}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{r.billing_name}</TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">
                    {r.license_plate ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{r.service_type_code ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{r.location_code ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{r.bay_no ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                  <TableCell className="text-right tabular-nums hidden md:table-cell">
                    {formatMoney(r.paid_amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.outstanding)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.payment_status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && <SalesPagination page={page} pageCount={pageCount} />}
    </div>
  );
}
