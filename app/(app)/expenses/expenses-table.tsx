"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayExpensesDialog } from "@/components/expenses/pay-expenses-dialog";
import { StatusBadge } from "@/components/sales/status-badge";
import type { ExpenseRow } from "@/lib/actions/expenses";
import { formatDate, formatMoney } from "@/lib/utils/format";

import { ListPagination } from "@/components/list-pagination";

export function ExpensesTable({
  rows,
  total,
  page,
  pageSize,
  hiddenColumns,
  canPay = false,
  payableLocationIds = null,
}: {
  rows: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Per-viewer hidden column keys from profiles.hidden_columns["expenses"]. */
  hiddenColumns?: string[];
  /** The viewer may record expense payments — shows the select column. */
  canPay?: boolean;
  /** Shops they may pay for; null = every shop. */
  payableLocationIds?: string[] | null;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);

  // Only an expense that still owes something, at a shop the viewer can pay
  // for, can be ticked.
  const payableRows = useMemo(
    () =>
      canPay
        ? rows.filter(
            (r) =>
              Number(r.balance) > 0 &&
              (payableLocationIds == null || payableLocationIds.includes(r.location_id)),
          )
        : [],
    [rows, canPay, payableLocationIds],
  );
  const payableIds = useMemo(() => new Set(payableRows.map((r) => r.id)), [payableRows]);
  // The list re-renders with fresh rows after a payment or a page change, so
  // the selection is read through what is payable now.
  const selectedRows = payableRows.filter((r) => selectedIds.has(r.id));
  const selectedBalance = selectedRows.reduce((a, r) => a + Number(r.balance), 0);
  const allSelected = payableRows.length > 0 && selectedRows.length === payableRows.length;

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(payableRows.map((r) => r.id)));

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
  const visibleCount = ALWAYS + HIDEABLE_CELLS.filter(Boolean).length + (canPay ? 1 : 0);

  const visibleTotal = rows.reduce((a, r) => a + Number(r.total ?? 0), 0);
  const visibleBalance = rows.reduce((a, r) => a + Number(r.balance ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>
            <strong>{selectedRows.length}</strong> selected ·{" "}
            <span className="tabular-nums">{formatMoney(selectedBalance)}</span> owing
          </span>
          <Button size="sm" onClick={() => setPaying(true)}>
            <CreditCard className="size-4" /> Mark as paid
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {canPay && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    disabled={payableRows.length === 0}
                    onCheckedChange={toggleAll}
                    aria-label="Select every unpaid expense on this page"
                  />
                </TableHead>
              )}
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
                <TableRow key={r.id} data-state={selectedIds.has(r.id) && payableIds.has(r.id) ? "selected" : undefined}>
                  {canPay && (
                    <TableCell>
                      {payableIds.has(r.id) && (
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                          aria-label={`Select expense ${r.invoice_no ?? formatDate(r.expense_date)}`}
                        />
                      )}
                    </TableCell>
                  )}
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
                  colSpan={(canPay ? 1 : 0) + 1 + (showCategoryCell ? 1 : 0) + (show("vendor") ? 1 : 0) + (show("invoice_no") ? 1 : 0) + 1}
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

      {pageCount > 1 && <ListPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} />}

      <PayExpensesDialog
        open={paying}
        onOpenChange={setPaying}
        expenses={selectedRows.map((r) => ({
          id: r.id,
          label: [r.vendor_name ?? r.vendor_name_snapshot ?? r.category_name ?? "Expense", r.invoice_no ? `#${r.invoice_no}` : formatDate(r.expense_date)].join(" · "),
          balance: Number(r.balance),
        }))}
        onPaid={() => {
          setSelectedIds(new Set());
          router.refresh();
        }}
      />
    </div>
  );
}
