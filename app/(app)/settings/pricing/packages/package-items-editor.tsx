"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartPickerButton } from "@/components/pricing/part-picker";
import type { Part, UnitOfMeasure } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

export interface PackageItemDraft {
  part_id: string;
  quantity: number;
  /**
   * Override price. null/undefined → use the catalog list_price at expansion.
   * Stored as a string in the form so an empty input means "no override".
   */
  unit_price: string;
  part: {
    brand: string;
    part_number: string;
    description: string | null;
    list_price: number;
    unit_of_measure: UnitOfMeasure;
  };
}

export function PackageItemsEditor({
  items,
  onChange,
}: {
  items: PackageItemDraft[];
  onChange: (items: PackageItemDraft[]) => void;
}) {
  const excludeIds = useMemo(() => new Set(items.map((it) => it.part_id)), [items]);

  const addPart = (p: Part) => {
    if (excludeIds.has(p.id)) return;
    onChange([
      ...items,
      {
        part_id: p.id,
        quantity: 1,
        unit_price: "", // blank = use catalog price
        part: {
          brand: p.brand,
          part_number: p.part_number,
          description: p.description,
          list_price: Number(p.list_price) || 0,
          unit_of_measure: p.unit_of_measure,
        },
      },
    ]);
  };

  const updateRow = (part_id: string, patch: Partial<PackageItemDraft>) => {
    onChange(items.map((it) => (it.part_id === part_id ? { ...it, ...patch } : it)));
  };

  const remove = (part_id: string) => {
    onChange(items.filter((it) => it.part_id !== part_id));
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground border rounded-md py-3 text-center">
          No parts yet — pick one from the catalogue below.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted-foreground border-b bg-muted/40">
                <th className="text-left font-medium py-2 px-3">Part</th>
                <th className="text-right font-medium py-2 px-2 w-24">Qty</th>
                <th className="text-right font-medium py-2 px-2 w-32">
                  Price override
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const overridden = it.unit_price.trim() !== "";
                return (
                  <tr key={it.part_id} className="border-b last:border-0 align-top">
                    <td className="py-2 px-3">
                      <div className="font-medium">
                        {it.part.brand} {it.part.part_number}
                      </div>
                      {it.part.description && (
                        <div className="text-xs text-muted-foreground">
                          {it.part.description}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Catalog: {formatMoney(it.part.list_price)}
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
                            updateRow(it.part_id, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                          className="text-right"
                        />
                        <span className="text-[10px] uppercase text-muted-foreground w-10 text-left">
                          {it.part.unit_of_measure}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unit_price}
                        placeholder={formatMoney(it.part.list_price)}
                        onChange={(e) =>
                          updateRow(it.part_id, { unit_price: e.target.value })
                        }
                        className="text-right"
                      />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(it.part_id)}
                        aria-label="Remove part"
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
        Leave the price blank to use the catalogue list price (so future price changes
        flow through). Enter a value to lock the price for this package.
      </p>

      <PartPickerButton
        onSelect={addPart}
        excludeIds={excludeIds}
        label="Add part to package"
      />
    </div>
  );
}
