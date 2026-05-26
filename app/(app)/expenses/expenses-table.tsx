import Link from "next/link";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/sales/status-badge";
import type { ExpenseRow } from "@/lib/actions/expenses";
import { formatDate, formatMoney } from "@/lib/utils/format";

import { ExpensesPagination } from "./expenses-pagination";

export function ExpensesTable({
  rows,
  total,
  page,
  pageSize,
  hiddenColumns,
}: {
  rows: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Per-viewer hidden column keys from profiles.hidden_columns["expenses"]. */
  hiddenColumns?: string[];
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hidden = new Set(hiddenColumns ?? []);
  const show = (key: string) => !hidden.has(key);

  // category and subcategory are rendered in the same cell; if either is on
  // we still render the cell, but suppress whichever piece is hidden.
  const showCategoryCell = show("category") || show("subcategory");

  const HIDEABLE_CELLS = [
    showCategoryCell,
    show("vendor"),
    show("invoice_no"),
    show("total"),
    show("paid"),
    show("balance"),
  ];
  const ALWAYS = 4; // Date, Loc, Status, Actions
  const visibleCount = ALWAYS + HIDEABLE_CELLS.filter(Boolean).length;

  const visibleTotal = rows.reduce((a, r) => a + Number(r.total ?? 0), 0);
  const visibleBalance = rows.reduce((a, r) => a + Number(r.balance ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              {showCategoryCell && <TableHead>Category</TableHead>}
              {show("vendor") && <TableHead>Vendor</TableHead>}
              {show("invoice_no") && <TableHead className="hidden md:table-cell">Invoice</TableHead>}
              <TableHead className="hidden md:table-cell w-16">Loc</TableHead>
              {show("total") && <TableHead className="text-right">Total</TableHead>}
              {show("paid") && <TableHead className="text-right hidden md:table-cell">Paid</TableHead>}
              {show("balance") && <TableHead className="text-right">Balance</TableHead>}
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="py-8 px-6 text-center text-muted-foreground">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">No expenses to show.</p>
                    <p className="text-sm">
                      Either nothing matches your current filters, or no expenses have been recorded yet. Use <strong>New expense</strong> to record your first bill, or clear the filters above to see everything.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.expense_date)}</TableCell>
                  {showCategoryCell && (
                    <TableCell>
                      <Link className="hover:underline" href={`/expenses/${r.id}`}>
                        {show("category") && (
                          <div className="font-medium">{r.category_name ?? "—"}</div>
                        )}
                        {show("subcategory") && r.subcategory_name && (
                          <div className="text-xs text-muted-foreground">{r.subcategory_name}</div>
                        )}
                      </Link>
                    </TableCell>
                  )}
                  {show("vendor") && (
                    <TableCell className="max-w-xs truncate">
                      {r.vendor_name ?? r.vendor_name_snapshot ?? "—"}
                    </TableCell>
                  )}
                  {show("invoice_no") && (
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {r.invoice_no ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell">{r.location_code ?? "—"}</TableCell>
                  {show("total") && (
                    <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                  )}
                  {show("paid") && (
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {formatMoney(r.paid_amount)}
                    </TableCell>
                  )}
                  {show("balance") && (
                    <TableCell className="text-right tabular-nums">{formatMoney(r.balance)}</TableCell>
                  )}
                  <TableCell>
                    <StatusBadge status={r.payment_status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon" aria-label="Edit expense">
                      <Link href={`/expenses/${r.id}/edit`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (show("total") || show("balance")) && (
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={1 + (showCategoryCell ? 1 : 0) + (show("vendor") ? 1 : 0) + (show("invoice_no") ? 1 : 0) + 1}
                  className="text-right text-xs text-muted-foreground"
                >
                  Page totals
                </TableCell>
                {show("total") && (
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(visibleTotal)}
                  </TableCell>
                )}
                {show("paid") && <TableCell className="hidden md:table-cell" />}
                {show("balance") && (
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(visibleBalance)}
                  </TableCell>
                )}
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {pageCount > 1 && <ExpensesPagination page={page} pageCount={pageCount} />}
    </div>
  );
}
