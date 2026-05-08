"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listVendorPartsForVendor } from "@/lib/actions/vendor-parts";
import type { VendorPartRow } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

export interface ExpenseLineItem {
  /** Local-only client id used for React keys; not persisted. */
  client_id: string;
  /** When set, the row was loaded from the server. */
  id?: string;
  part_id: string | null;
  vendor_part_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
}

export function lineItemsSubTotal(items: ExpenseLineItem[]): number {
  return items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0),
    0,
  );
}

function makeClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newExpenseLineItem(partial: Partial<ExpenseLineItem> = {}): ExpenseLineItem {
  return {
    client_id: makeClientId(),
    part_id: null,
    vendor_part_id: null,
    description: "",
    quantity: 1,
    unit_cost: 0,
    ...partial,
  };
}

export function ExpenseLineItems({
  vendorId,
  items,
  onChange,
}: {
  vendorId: string | null;
  items: ExpenseLineItem[];
  onChange: (next: ExpenseLineItem[]) => void;
}) {
  const [vendorParts, setVendorParts] = useState<VendorPartRow[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);

  // Pull the vendor's catalog whenever the chosen vendor changes. If no vendor
  // is set, fall back to an empty list — the user can still type free-text rows.
  useEffect(() => {
    if (!vendorId) {
      setVendorParts([]);
      return;
    }
    let cancelled = false;
    setLoadingParts(true);
    listVendorPartsForVendor(vendorId)
      .then((rows) => {
        if (!cancelled) setVendorParts(rows);
      })
      .catch(() => {
        if (!cancelled) setVendorParts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingParts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const addBlankRow = () => onChange([...items, newExpenseLineItem()]);

  const addVendorPart = (vp: VendorPartRow) => {
    if (!vp.part) return;
    onChange([
      ...items,
      newExpenseLineItem({
        part_id: vp.part.id,
        vendor_part_id: vp.id,
        description: `${vp.part.brand} ${vp.part.part_number}${
          vp.part.description ? ` — ${vp.part.description}` : ""
        }`,
        quantity: 1,
        unit_cost: Number(vp.cost) || 0,
      }),
    ]);
  };

  const removeRow = (clientId: string) => {
    onChange(items.filter((x) => x.client_id !== clientId));
  };

  const patchRow = (clientId: string, patch: Partial<ExpenseLineItem>) => {
    onChange(items.map((x) => (x.client_id === clientId ? { ...x, ...patch } : x)));
  };

  const total = lineItemsSubTotal(items);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        {vendorId ? (
          vendorParts.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {loadingParts
                ? "Loading vendor parts…"
                : "This vendor has no parts assigned. Add one on the vendor's page, or use Custom line below."}
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Add part from this vendor</label>
                <Select
                  onValueChange={(id) => {
                    const vp = vendorParts.find((v) => v.id === id);
                    if (vp) addVendorPart(vp);
                  }}
                  value=""
                >
                  <SelectTrigger className="w-[360px]">
                    <SelectValue placeholder="Pick a part…" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorParts.map((vp) =>
                      vp.part ? (
                        <SelectItem key={vp.id} value={vp.id}>
                          {vp.part.part_number} — {vp.part.brand}
                          {vp.part.description ? ` (${vp.part.description})` : ""}
                          {" · "}
                          {formatMoney(vp.cost)}
                        </SelectItem>
                      ) : null,
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        ) : (
          <div className="text-xs text-muted-foreground">
            Pick a vendor above to see their parts. You can also add custom lines.
          </div>
        )}
        <div className="ml-auto">
          <Button type="button" variant="outline" size="sm" onClick={addBlankRow}>
            <Plus className="size-4" /> Custom line
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border p-4 text-sm text-center text-muted-foreground">
          No line items yet. Add a part from the vendor or a custom line.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Unit cost</TableHead>
                <TableHead className="w-32 text-right">Line total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const lineTotal =
                  (Number(row.quantity) || 0) * (Number(row.unit_cost) || 0);
                return (
                  <TableRow key={row.client_id}>
                    <TableCell>
                      <Input
                        value={row.description}
                        onChange={(e) => patchRow(row.client_id, { description: e.target.value })}
                        placeholder="e.g. 5W30 oil — 5L"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-right"
                        value={row.quantity}
                        onChange={(e) =>
                          patchRow(row.client_id, { quantity: Number(e.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-right"
                        value={row.unit_cost}
                        onChange={(e) =>
                          patchRow(row.client_id, { unit_cost: Number(e.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(lineTotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.client_id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end px-4 py-2 border-t bg-muted/30 text-sm">
            <span className="text-muted-foreground">Items total</span>
            <span className="ml-3 font-medium tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
