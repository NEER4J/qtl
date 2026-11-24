import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/pricing/print-button";
import { getStockTransfer } from "@/lib/actions/stock-transfers";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

/** Short, readable reference for a transfer: TR- + the first 8 of its id. */
function transferNo(id: string): string {
  return `TR-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/**
 * Printable transfer note, kept on file like an invoice (client 2026-11-24:
 * "a transfer between locations should make a record, like an invoice").
 * One per transfer, with signature lines for the sending and receiving shop.
 */
export default async function TransferNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getStockTransfer(id);
  if (!t) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <style>{"@media print { @page { size: portrait; margin: 0.5in; } }"}</style>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/inventory/transfers">
            <ChevronLeft className="size-4" /> Back to transfers
          </Link>
        </Button>
        <PrintButton />
      </div>

      <div className="rounded-md border p-6 text-sm print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-xl font-bold">Quick Truck Lube</div>
            <div className="text-muted-foreground">Stock transfer note</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{transferNo(t.id)}</div>
            <div>{formatDate(t.transfer_date)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b py-4">
          <div>
            <div className="text-xs uppercase text-muted-foreground">From</div>
            <div className="text-base font-semibold">{t.from_location}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">To</div>
            <div className="text-base font-semibold">{t.to_location}</div>
          </div>
        </div>

        <table className="my-4 w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-2 font-semibold">Item</th>
              <th className="py-2 pr-2 text-right font-semibold">Qty</th>
              <th className="py-2 pr-2 text-right font-semibold">Cost each</th>
              <th className="py-2 text-right font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-2">{t.item}</td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {t.quantity}
                {t.kind === "oil" ? " L" : ""}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">{formatMoney(t.unit_cost)}</td>
              <td className="py-2 text-right tabular-nums font-semibold">{formatMoney(t.value)}</td>
            </tr>
          </tbody>
        </table>

        {t.notes && (
          <p className="mb-4">
            <span className="text-muted-foreground">Notes: </span>
            {t.notes}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Entered by {t.created_by_name ?? "—"} on {formatDate(t.created_at)}. Valued at catalogue cost.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-8 text-xs">
          <div className="border-t pt-1">Sent by ({t.from_location})</div>
          <div className="border-t pt-1">Received by ({t.to_location})</div>
        </div>
      </div>
    </div>
  );
}
