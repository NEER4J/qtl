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
import { formatCardOnFile, isCardMode, paymentModeLabel } from "@/lib/utils/payment-modes";

import { ListPagination } from "@/components/list-pagination";

export function SalesTable({
  rows,
  total,
  page,
  pageSize,
  hiddenColumns,
  params = {},
}: {
  rows: SalesJobRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Per-viewer hidden column keys from profiles.hidden_columns["sales"]. */
  hiddenColumns?: string[];
  /** The list's current query string, for the search-field headers. */
  params?: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hidden = new Set(hiddenColumns ?? []);
  const show = (key: string) => !hidden.has(key);

  // Count visible columns so the empty-state row spans correctly.
  const HIDEABLE = ["invoice_no", "customer", "vehicle", "bay", "total", "paid", "credit", "outstanding", "payment_status", "payment_method"] as const;
  const ALWAYS = 3; // Date, Svc, Loc
  const visibleCount = ALWAYS + HIDEABLE.filter(show).length;

  // Clicking Invoice / Customer / Plate searches that column only (client
  // 2026-10-20 — "click to highlight the column"); the search box keeps its text.
  const activeField = params.field ?? "all";
  const SearchHead = ({ field, label, className }: { field: string; label: string; className?: string }) => {
    const next = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => e[1] != null),
    );
    next.delete("page");
    if (activeField === field) next.delete("field");
    else next.set("field", field);
    const active = activeField === field;
    return (
      <TableHead className={className}>
        <Link
          href={`/sales?${next.toString()}`}
          scroll={false}
          title={active ? "Searching this column — click to search all fields" : `Search ${label.toLowerCase()} only`}
          className={
            active
              ? "rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-foreground underline underline-offset-4"
              : "rounded px-1.5 py-0.5 hover:bg-muted"
          }
        >
          {label}
        </Link>
      </TableHead>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              {show("invoice_no") && <SearchHead field="invoice" label="Invoice" />}
              {show("customer") && <SearchHead field="customer" label="Customer" />}
              {show("vehicle") && <SearchHead field="plate" label="Plate" className="hidden md:table-cell" />}
              <TableHead className="hidden md:table-cell w-16">Svc</TableHead>
              <TableHead className="hidden md:table-cell w-16">Loc</TableHead>
              {show("bay") && <TableHead className="hidden md:table-cell w-12">Bay</TableHead>}
              {show("total") && <TableHead className="text-right">Total</TableHead>}
              {show("paid") && <TableHead className="text-right hidden md:table-cell">Paid</TableHead>}
              {show("credit") && <TableHead className="text-right hidden md:table-cell">Credit</TableHead>}
              {show("outstanding") && <TableHead className="text-right">Outstanding</TableHead>}
              {show("payment_status") && <TableHead className="w-28">Status</TableHead>}
              {show("payment_method") && <TableHead className="hidden lg:table-cell">Payment</TableHead>}
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
                    <TableCell className="max-w-xs truncate">
                      {r.customer_id ? (
                        <Link className="hover:underline" href={`/customers/${r.customer_id}`}>
                          {r.billing_name}
                        </Link>
                      ) : (
                        r.billing_name
                      )}
                    </TableCell>
                  )}
                  {show("vehicle") && (
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {r.license_plate && r.customer_id && r.vehicle_id ? (
                        <Link
                          className="hover:underline"
                          href={`/customers/${r.customer_id}/vehicles/${r.vehicle_id}/history`}
                        >
                          {r.license_plate}
                        </Link>
                      ) : (
                        r.license_plate ?? "—"
                      )}
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
                  {show("credit") && (
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {Number(r.credit_applied ?? 0) > 0 ? (
                        formatMoney(Number(r.credit_applied))
                      ) : r.total < -0.005 ? (
                        <span className="text-emerald-600">{formatMoney(Math.abs(r.total))} issued</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                  {show("payment_method") && (
                    <TableCell className="hidden lg:table-cell text-xs">
                      <PaymentSummary row={r} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && <ListPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} />}
    </div>
  );
}

/** Every tender on the job ("Cash + Visa"), with the card on file for cards. */
function PaymentSummary({ row }: { row: SalesJobRow }) {
  // Legacy / imported jobs settled paid_amount without ledger rows.
  const modes = row.payments.length > 0
    ? [...new Set(row.payments.map((p) => p.mode))]
    : row.paid_amount > 0 && row.payment_mode
      ? [row.payment_mode]
      : [];
  if (modes.length === 0) return <span className="text-muted-foreground">—</span>;
  const card = modes.some(isCardMode)
    ? formatCardOnFile(row.customer_card_number, row.customer_card_expiry)
    : null;
  return (
    <div>
      <div>{modes.map(paymentModeLabel).join(" + ")}</div>
      {card && <div className="font-mono text-[11px] text-muted-foreground">{card}</div>}
    </div>
  );
}
