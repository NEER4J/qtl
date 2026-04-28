"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PartPickerButton } from "@/components/pricing/part-picker";
import { PackagePickerButton } from "@/components/sales/package-picker-button";
import type { Part, PartPackageWithItems, UnitOfMeasure } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

export interface LineItem {
  /** Local key for React; not persisted. */
  key: string;
  /** Set if linked to a catalog part; null for custom rows. */
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  /** Whether this line contributes to the HST taxable subtotal. Defaults true. */
  is_taxable: boolean;
  /** Unit label shown beside qty ("3 ltr"). null for custom rows. */
  unit_of_measure: UnitOfMeasure | null;
  /** Snapshot of the package this row was expanded from; null for individual lines. */
  package_label?: string | null;
}

export function newLineItem(partial: Partial<LineItem> = {}): LineItem {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    part_id: null,
    description: "",
    quantity: 1,
    unit_price: 0,
    is_taxable: true,
    unit_of_measure: null,
    package_label: null,
    ...partial,
  };
}

export function lineItemTotal(item: LineItem): number {
  const q = Number(item.quantity);
  const p = Number(item.unit_price);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return Math.round(q * p * 100) / 100;
}

export function lineItemsSubTotal(items: LineItem[]): number {
  let total = 0;
  for (const it of items) total += lineItemTotal(it);
  return Math.round(total * 100) / 100;
}

/** Sum of line totals where is_taxable === true — the HST base. */
export function lineItemsTaxableSubTotal(items: LineItem[]): number {
  let total = 0;
  for (const it of items) {
    if (it.is_taxable) total += lineItemTotal(it);
  }
  return Math.round(total * 100) / 100;
}

export function SalesLineItems({
  items,
  onChange,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}) {
  const update = (key: string, patch: Partial<LineItem>) => {
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const remove = (key: string) => onChange(items.filter((it) => it.key !== key));
  const addCustom = () => onChange([...items, newLineItem()]);
  const addPart = (p: Part) => {
    onChange([
      ...items,
      newLineItem({
        part_id: p.id,
        description: `${p.brand} ${p.part_number}${p.description ? ` — ${p.description}` : ""}`,
        quantity: 1,
        unit_price: Number(p.list_price) || 0,
        is_taxable: p.is_taxable,
        unit_of_measure: p.unit_of_measure,
      }),
    ]);
  };
  const addPackage = (pkg: PartPackageWithItems) => {
    const rows = pkg.items.map((it) => {
      // Override on the package wins; otherwise use catalog list_price.
      const price =
        it.unit_price != null ? Number(it.unit_price) : Number(it.part.list_price);
      return newLineItem({
        part_id: it.part_id,
        description: `${it.part.brand} ${it.part.part_number}${
          it.part.description ? ` — ${it.part.description}` : ""
        }`,
        quantity: Number(it.quantity) || 1,
        unit_price: Number.isFinite(price) ? price : 0,
        is_taxable: it.part.is_taxable,
        unit_of_measure: it.part.unit_of_measure,
        package_label: pkg.name,
      });
    });
    onChange([...items, ...rows]);
  };

  const total = lineItemsSubTotal(items);
  const taxable = lineItemsTaxableSubTotal(items);
  const exempt = Math.round((total - taxable) * 100) / 100;

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No line items yet — add parts from the catalog or a custom item.
        </p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted-foreground border-b">
                <th className="text-left font-medium py-2 pr-2">Description</th>
                <th className="text-right font-medium py-2 px-2 w-32">Qty</th>
                <th className="text-right font-medium py-2 px-2 w-28">Unit price</th>
                <th className="text-center font-medium py-2 px-2 w-16">Tax</th>
                <th className="text-right font-medium py-2 px-2 w-28">Line total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-2">
                    <Input
                      value={it.description}
                      onChange={(e) => update(it.key, { description: e.target.value, part_id: it.part_id })}
                      placeholder={it.part_id ? "Part description" : "Custom item description"}
                    />
                    {(it.part_id || it.package_label) && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {it.part_id && <span>From catalog</span>}
                        {it.part_id && it.package_label && <span> · </span>}
                        {it.package_label && (
                          <span className="italic">from {it.package_label}</span>
                        )}
                      </p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={String(it.quantity)}
                        onChange={(e) => update(it.key, { quantity: Number(e.target.value) || 0 })}
                        className="text-right"
                      />
                      {it.unit_of_measure && (
                        <span className="text-[10px] uppercase text-muted-foreground w-10 text-left">
                          {it.unit_of_measure}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={String(it.unit_price)}
                      onChange={(e) => update(it.key, { unit_price: Number(e.target.value) || 0 })}
                      className="text-right"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Checkbox
                      checked={it.is_taxable}
                      onCheckedChange={(v) => update(it.key, { is_taxable: v === true })}
                      aria-label="HST taxable"
                    />
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-medium">
                    {formatMoney(lineItemTotal(it))}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(it.key)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="py-2 pr-2 text-right text-xs uppercase text-muted-foreground">
                  Items sub total
                </td>
                <td className="py-2 px-2 text-right tabular-nums font-semibold">
                  {formatMoney(total)}
                </td>
                <td />
              </tr>
              {exempt > 0 && (
                <tr>
                  <td colSpan={4} className="py-1 pr-2 text-right text-[11px] text-muted-foreground">
                    HST taxable / exempt
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums text-[11px] text-muted-foreground">
                    {formatMoney(taxable)} / {formatMoney(exempt)}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <PartPickerButton onSelect={addPart} />
        <PackagePickerButton onSelect={addPackage} />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          <Plus className="size-4" /> Add custom item
        </Button>
      </div>
    </div>
  );
}
