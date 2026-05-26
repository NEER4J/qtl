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
  hiddenColumns,
}: {
  rows: SalesJobRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Per-viewer hidden column keys from profiles.hidden_columns["sales"]. */
  hiddenColumns?: string[];
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hidden = new Set(hiddenColumns ?? []);
  const show = (key: string) => !hidden.has(key);

  // Count visible columns so the empty-state row spans correctly.
  const HIDEABLE = ["invoice_no", "customer", "vehicle", "bay", "total", "paid", "outstanding", "payment_status"] as const;
  const ALWAYS = 3; // Date, Svc, Loc
  const visibleCount = ALWAYS + HIDEABLE.filter(show).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              {show("invoice_no") && <TableHead>Invoice</TableHead>}
              {show("customer") && <TableHead>Customer</TableHead>}
              {show("vehicle") && <TableHead className="hidden md:table-cell">Plate</TableHead>}
              <TableHead className="hidden md:table-cell w-16">Svc</TableHead>
              <TableHead className="hidden md:table-cell w-16">Loc</TableHead>
              {show("bay") && <TableHead className="hidden md:table-cell w-12">Bay</TableHead>}
              {show("total") && <TableHead className="text-right">Total</TableHead>}
              {show("paid") && <TableHead className="text-right hidden md:table-cell">Paid</TableHead>}
              {show("outstanding") && <TableHead className="text-right">Outstanding</TableHead>}
              {show("payment_status") && <TableHead className="w-28">Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="py-8 px-6 text-center text-muted-foreground">
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
                  {show("invoice_no") && (
                    <TableCell>
                      <Link className="font-mono hover:underline" href={`/sales/${r.id}`}>
                        {r.invoice_no}
                      </Link>
                    </TableCell>
                  )}
                  {show("customer") && (
                    <TableCell className="max-w-xs truncate">{r.billing_name}</TableCell>
                  )}
                  {show("vehicle") && (
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {r.license_plate ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell">{r.service_type_code ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{r.location_code ?? "—"}</TableCell>
                  {show("bay") && (
                    <TableCell className="hidden md:table-cell">{r.bay_no ?? "—"}</TableCell>
                  )}
                  {show("total") && (
                    <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                  )}
                  {show("paid") && (
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {formatMoney(r.paid_amount)}
                    </TableCell>
                  )}
                  {show("outstanding") && (
                    <TableCell className="text-right tabular-nums">{formatMoney(r.outstanding)}</TableCell>
                  )}
                  {show("payment_status") && (
                    <TableCell>
                      <StatusBadge status={r.payment_status} />
                    </TableCell>
                  )}
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
