"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartPickerButton } from "@/components/pricing/part-picker";
import {
  TransServicePickerButton,
  transServiceLabel,
  transServicePrice,
} from "@/components/pricing/trans-service-picker";
import type { PartForPicker, TransmissionService } from "@/lib/actions/pricing";
import type { UnitOfMeasure } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

export interface PackageItemDraft {
  /** Which catalogue this item is drawn from. */
  source: "part" | "trans";
  /** Set when source === "part". */
  part_id: string | null;
  /** Set when source === "trans". */
  transmission_service_id: string | null;
  quantity: number;
  /**
   * Override price. blank → use the catalogue price at expansion (part list
   * price, or service sell + labour). Stored as a string so empty = no override.
   */
  unit_price: string;
  /** Display label + the catalogue price used as the override placeholder. */
  label: string;
  subLabel: string | null;
  catalogPrice: number;
  unitOfMeasure: string;
}

function draftKey(it: PackageItemDraft): string {
  return it.source === "part" ? `part:${it.part_id}` : `trans:${it.transmission_service_id}`;
}

export function PackageItemsEditor({
  items,
  onChange,
}: {
  items: PackageItemDraft[];
  onChange: (items: PackageItemDraft[]) => void;
}) {
  const excludePartIds = useMemo(
    () => new Set(items.filter((it) => it.source === "part").map((it) => it.part_id as string)),
    [items],
  );
  const excludeTransIds = useMemo(
    () =>
      new Set(
        items
          .filter((it) => it.source === "trans")
          .map((it) => it.transmission_service_id as string),
      ),
    [items],
  );

  const addPart = (p: PartForPicker) => {
    if (excludePartIds.has(p.id)) return;
    onChange([
      ...items,
      {
        source: "part",
        part_id: p.id,
        transmission_service_id: null,
        quantity: 1,
        unit_price: "",
        label: `${p.brand} ${p.part_number}`,
        subLabel: p.description,
        // Packages charge the With Service price (cost + service charge).
        catalogPrice: Number(p.with_service ?? p.list_price) || 0,
        unitOfMeasure: (p.unit_of_measure as UnitOfMeasure) ?? "pcs",
      },
    ]);
  };

  const addTrans = (s: TransmissionService) => {
    if (excludeTransIds.has(s.id)) return;
    onChange([
      ...items,
      {
        source: "trans",
        part_id: null,
        transmission_service_id: s.id,
        quantity: 1,
        unit_price: "",
        label: transServiceLabel(s),
        subLabel: s.oil_type_name,
        catalogPrice: transServicePrice(s),
        unitOfMeasure: "each",
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<PackageItemDraft>) => {
    onChange(items.map((it) => (draftKey(it) === key ? { ...it, ...patch } : it)));
  };

  const remove = (key: string) => {
    onChange(items.filter((it) => draftKey(it) !== key));
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground border rounded-md py-3 text-center">
          No items yet — add a part or a Trans &amp; Diff service below.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted-foreground border-b bg-muted/40">
                <th className="text-left font-medium py-2 px-3">Item</th>
                <th className="text-right font-medium py-2 px-2 w-24">Qty</th>
                <th className="text-right font-medium py-2 px-2 w-28">Total</th>
                <th className="text-right font-medium py-2 px-2 w-32">Price override</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const key = draftKey(it);
                const overridden = it.unit_price.trim() !== "";
                // Effective per-unit price = override (when set) else catalogue.
                // Total recomputes live as Qty or the override changes.
                const effectiveUnit = overridden
                  ? Number(it.unit_price) || 0
                  : it.catalogPrice;
                const lineTotal = (Number(it.quantity) || 0) * effectiveUnit;
                return (
                  <tr key={key} className="border-b last:border-0 align-top">
                    <td className="py-2 px-3">
                      <div className="font-medium">{it.label}</div>
                      {it.subLabel && (
                        <div className="text-xs text-muted-foreground">{it.subLabel}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {it.source === "trans" ? "Trans & Diff · " : ""}
                        Catalog: {formatMoney(it.catalogPrice)}
                        {overridden && (
                          <span className="ml-1 text-amber-600 dark:text-amber-500">
                            · overridden
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={String(it.quantity)}
                          onChange={(e) =>
                            updateRow(key, { quantity: Number(e.target.value) || 0 })
                          }
                          className="text-right"
                        />
                        <span className="text-[10px] uppercase text-muted-foreground w-10 text-left">
                          {it.unitOfMeasure}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">
                      {formatMoney(lineTotal)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unit_price}
                        placeholder={formatMoney(it.catalogPrice)}
                        onChange={(e) => updateRow(key, { unit_price: e.target.value })}
                        className="text-right"
                      />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(key)}
                        aria-label="Remove item"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <strong>Total</strong> = Qty × price and updates as you change them. <strong>Price
        override</strong> is per-unit — leave it blank to use the catalogue price (so future
        price changes flow through), or enter a value to lock this package&apos;s per-unit price.
      </p>

      <div className="flex flex-wrap gap-2">
        <PartPickerButton
          onSelect={addPart}
          excludeIds={excludePartIds}
          label="Add part to package"
        />
        <TransServicePickerButton onSelect={addTrans} excludeIds={excludeTransIds} />
      </div>
    </div>
  );
}
