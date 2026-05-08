"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { mergePartPackagePrices } from "@/lib/actions/pricing";
import type { PartPackageWithItems } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import {
  effectiveCatalogPriceForItem,
  effectiveLockedPriceForItem,
} from "@/lib/utils/package-pricing";

type RowState = { item_id: string; new_unit_price: string };

export function MergePricesDialog({
  open,
  onOpenChange,
  pkg,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg?: PartPackageWithItems;
}) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<RowState[]>([]);
  const [labor, setLabor] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pkg) return;
    setRows(
      pkg.items.map((it) => ({
        item_id: it.id,
        new_unit_price: effectiveCatalogPriceForItem(it).toFixed(2),
      })),
    );
    setLabor((Number(pkg.labor_selling_price) || 0).toFixed(2));
    setError(null);
  }, [open, pkg]);

  const display = useMemo(() => {
    if (!pkg) return [];
    return pkg.items.map((it) => {
      const locked = effectiveLockedPriceForItem(it);
      const catalog = effectiveCatalogPriceForItem(it);
      const label = it.part
        ? `${it.part.brand} ${it.part.part_number}`
        : it.oil_type
        ? `${it.oil_type.code} (${it.oil_container ?? "bulk"})`
        : "—";
      return { id: it.id, label, qty: Number(it.quantity), locked, catalog };
    });
  }, [pkg]);

  if (!pkg) return null;

  const laborLocked =
    pkg.labor_locked_selling_price != null
      ? Number(pkg.labor_locked_selling_price)
      : Number(pkg.labor_selling_price) || 0;
  const laborCatalog = Number(pkg.labor_selling_price) || 0;

  const updateRow = (item_id: string, value: string) =>
    setRows((prev) =>
      prev.map((r) => (r.item_id === item_id ? { ...r, new_unit_price: value } : r)),
    );

  const onSubmit = () => {
    setError(null);
    const items = rows.map((r) => ({
      item_id: r.item_id,
      new_unit_price: Number(r.new_unit_price) || 0,
    }));
    const labor_selling_price = Number(labor) || 0;
    startTransition(async () => {
      const res = await mergePartPackagePrices({ id: pkg.id, items, labor_selling_price });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Prices merged");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review &amp; merge package prices</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The catalog has changed since this package was locked. Edit any price
          if you want to override the new catalog value, then apply. The lock
          stays in place; the snapshot is refreshed.
        </p>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-xs uppercase text-muted-foreground border-b">
                <th className="text-left font-medium py-2 px-3">Item</th>
                <th className="text-right font-medium py-2 px-2 w-16">Qty</th>
                <th className="text-right font-medium py-2 px-2 w-24">Locked</th>
                <th className="text-right font-medium py-2 px-2 w-24">Catalog</th>
                <th className="text-right font-medium py-2 px-2 w-20">Δ</th>
                <th className="text-right font-medium py-2 px-2 w-32">New price</th>
              </tr>
            </thead>
            <tbody>
              {display.map((d) => {
                const delta = Math.round((d.catalog - d.locked) * 100) / 100;
                const row = rows.find((r) => r.item_id === d.id);
                return (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2 px-3">{d.label}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{d.qty}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                      {formatMoney(d.locked)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatMoney(d.catalog)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span
                        className={
                          delta > 0
                            ? "text-rose-600"
                            : delta < 0
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        }
                      >
                        {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${formatMoney(delta)}`}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row?.new_unit_price ?? ""}
                        onChange={(e) => updateRow(d.id, e.target.value)}
                        className="text-right h-8"
                      />
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-amber-50/50 dark:bg-amber-950/20">
                <td className="py-2 px-3 font-medium">
                  {pkg.labor_description ?? "Labor"}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">1</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                  {formatMoney(laborLocked)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatMoney(laborCatalog)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {(() => {
                    const d = Math.round((laborCatalog - laborLocked) * 100) / 100;
                    return (
                      <span
                        className={
                          d > 0
                            ? "text-rose-600"
                            : d < 0
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        }
                      >
                        {d === 0 ? "—" : `${d > 0 ? "+" : ""}${formatMoney(d)}`}
                      </span>
                    );
                  })()}
                </td>
                <td className="py-2 px-2 text-right">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={labor}
                    onChange={(e) => setLabor(e.target.value)}
                    className="text-right h-8"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isPending}>
            {isPending ? "Applying…" : "Apply prices"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
