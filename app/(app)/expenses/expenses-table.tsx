import Link from "next/link";

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
}: {
  rows: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const visibleTotal = rows.reduce((a, r) => a + Number(r.total ?? 0), 0);
  const visibleBalance = rows.reduce((a, r) => a + Number(r.balance ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="hidden md:table-cell">Invoice</TableHead>
              <TableHead className="hidden md:table-cell w-16">Loc</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right hidden md:table-cell">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 px-6 text-center text-muted-foreground">
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
                  <TableCell>
                    <Link className="hover:underline" href={`/expenses/${r.id}`}>
                      <div className="font-medium">{r.category_name ?? "—"}</div>
                      {r.subcategory_name && (
                        <div className="text-xs text-muted-foreground">{r.subcategory_name}</div>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {r.vendor_name ?? r.vendor_name_snapshot ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">
                    {r.invoice_no ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{r.location_code ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                  <TableCell className="text-right tabular-nums hidden md:table-cell">
                    {formatMoney(r.paid_amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.balance)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.payment_status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="text-right text-xs text-muted-foreground">
                  Page totals
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(visibleTotal)}
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right tabular-nums">
                  {formatMoney(visibleBalance)}
                </TableCell>
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
