"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PartPickerButton } from "@/components/pricing/part-picker";
import { PackagePickerButton } from "@/components/sales/package-picker-button";
import type { Part, PartPackageWithItems, UnitOfMeasure } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import {
  effectiveCatalogPriceForItem,
  effectiveLockedPriceForItem,
  isPartPackageLocked,
} from "@/lib/utils/package-pricing";

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
  /** True when the customer brought the part themselves; line_total forced to 0. */
  is_customer_supplied?: boolean;
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
    is_customer_supplied: false,
    ...partial,
  };
}

export function lineItemTotal(item: LineItem): number {
  if (item.is_customer_supplied) return 0;
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

type PendingPart = { kind: "part"; part: Part };
type PendingPackage = {
  kind: "package";
  pkg: PartPackageWithItems;
  /** part_ids of items already on the job that would create a duplicate. */
  dupePartIds: Set<string>;
};
type PendingAdd = PendingPart | PendingPackage | null;

export function SalesLineItems({
  items,
  onChange,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}) {
  const [pending, setPending] = useState<PendingAdd>(null);

  const update = (key: string, patch: Partial<LineItem>) => {
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const remove = (key: string) => onChange(items.filter((it) => it.key !== key));
  const addCustom = () => onChange([...items, newLineItem()]);

  const partAlreadyOnJob = (partId: string) =>
    items.some((it) => it.part_id === partId);

  const partUnitPrice = (p: Part, isDuplicate: boolean): number => {
    if (isDuplicate && p.duplicate_unit_price != null) {
      return Number(p.duplicate_unit_price);
    }
    return Number(p.list_price) || 0;
  };

  const lineFromPart = (p: Part, isDuplicate: boolean): LineItem =>
    newLineItem({
      part_id: p.id,
      description: `${p.brand} ${p.part_number}${p.description ? ` — ${p.description}` : ""}`,
      quantity: 1,
      unit_price: partUnitPrice(p, isDuplicate),
      is_taxable: p.is_taxable,
      unit_of_measure: p.unit_of_measure,
    });

  const expandPackage = (
    pkg: PartPackageWithItems,
    options: { skipDupes: boolean; dupePartIds: Set<string> },
  ): LineItem[] => {
    const locked = isPartPackageLocked(pkg);
    const rows: LineItem[] = [];
    for (const it of pkg.items) {
      const isPartDupe =
        it.part_id != null && options.dupePartIds.has(it.part_id);
      if (options.skipDupes && isPartDupe) continue;

      let price: number;
      let description: string;
      let isTaxable: boolean;
      let unitOfMeasure: LineItem["unit_of_measure"];
      if (it.oil_type_id && it.oil_type) {
        // Item #18 — oil-type rows price from the oil-types catalogue (matches
        // the oil grid). Locks override that with the snapshot.
        price = locked
          ? effectiveLockedPriceForItem(it)
          : effectiveCatalogPriceForItem(it);
        const litres = Number(it.litres ?? 0);
        description = `${it.oil_type.code} — ${it.oil_type.name}${
          it.oil_container ? ` (${it.oil_container})` : ""
        }${litres ? ` × ${litres}L` : ""}`;
        isTaxable = it.oil_type.is_taxable;
        unitOfMeasure = "ltr";
      } else if (it.part) {
        if (locked) {
          price = effectiveLockedPriceForItem(it);
        } else if (isPartDupe && it.part.duplicate_unit_price != null) {
          // Confirmed duplicate AND no manual override → fall back to dup price.
          price =
            it.unit_price != null
              ? Number(it.unit_price)
              : Number(it.part.duplicate_unit_price);
        } else {
          price = effectiveCatalogPriceForItem(it);
        }
        description = `${it.part.brand} ${it.part.part_number}${
          it.part.description ? ` — ${it.part.description}` : ""
        }`;
        isTaxable = it.part.is_taxable;
        unitOfMeasure = it.part.unit_of_measure;
      } else {
        continue;
      }
      rows.push(
        newLineItem({
          part_id: it.part_id ?? null,
          description,
          quantity: Number(it.quantity) || 1,
          unit_price: Number.isFinite(price) ? price : 0,
          is_taxable: isTaxable,
          unit_of_measure: unitOfMeasure,
          package_label: pkg.name,
        }),
      );
    }

    // Labor line (item #2) — added once per package, regardless of duplicates.
    const laborSell = locked
      ? Number(pkg.labor_locked_selling_price ?? pkg.labor_selling_price) || 0
      : Number(pkg.labor_selling_price) || 0;
    if (laborSell > 0) {
      rows.push(
        newLineItem({
          part_id: null,
          description: pkg.labor_description ?? "Labor",
          quantity: 1,
          unit_price: laborSell,
          is_taxable: true,
          unit_of_measure: null,
          package_label: pkg.name,
        }),
      );
    }
    return rows;
  };

  const addPart = (p: Part) => {
    if (partAlreadyOnJob(p.id)) {
      setPending({ kind: "part", part: p });
      return;
    }
    onChange([...items, lineFromPart(p, false)]);
  };

  const addPackage = (pkg: PartPackageWithItems) => {
    const dupePartIds = new Set<string>();
    for (const it of pkg.items) {
      if (it.part_id && partAlreadyOnJob(it.part_id)) dupePartIds.add(it.part_id);
    }
    if (dupePartIds.size > 0) {
      setPending({ kind: "package", pkg, dupePartIds });
      return;
    }
    onChange([...items, ...expandPackage(pkg, { skipDupes: false, dupePartIds })]);
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === "part") {
      onChange([...items, lineFromPart(pending.part, true)]);
    } else {
      onChange([
        ...items,
        ...expandPackage(pending.pkg, {
          skipDupes: false,
          dupePartIds: pending.dupePartIds,
        }),
      ]);
    }
    setPending(null);
  };

  const declinePending = () => {
    if (!pending) return;
    if (pending.kind === "package") {
      // Drop just the duplicate rows; expand the rest (and labor).
      onChange([
        ...items,
        ...expandPackage(pending.pkg, {
          skipDupes: true,
          dupePartIds: pending.dupePartIds,
        }),
      ]);
    }
    setPending(null);
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
                <th className="text-center font-medium py-2 px-2 w-24" title="Customer brought this part">
                  Cust. supp.
                </th>
                <th className="text-right font-medium py-2 px-2 w-28">Line total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const cs = it.is_customer_supplied === true;
                const wouldHaveCharged = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                return (
                  <tr key={it.key} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-2">
                      <Input
                        value={it.description}
                        onChange={(e) => update(it.key, { description: e.target.value, part_id: it.part_id })}
                        placeholder={it.part_id ? "Part description" : "Custom item description"}
                      />
                      {(it.part_id || it.package_label || cs) && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {it.part_id && <span>From catalog</span>}
                          {it.part_id && it.package_label && <span> · </span>}
                          {it.package_label && (
                            <span className="italic">from {it.package_label}</span>
                          )}
                          {cs && (
                            <span className="ml-1 text-emerald-600">
                              · customer supplied — saved {formatMoney(wouldHaveCharged)}
                            </span>
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
                        className={`text-right ${cs ? "opacity-60" : ""}`}
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Checkbox
                        checked={it.is_taxable}
                        onCheckedChange={(v) => update(it.key, { is_taxable: v === true })}
                        aria-label="HST taxable"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Checkbox
                        checked={cs}
                        disabled={!it.part_id}
                        onCheckedChange={(v) => update(it.key, { is_customer_supplied: v === true })}
                        aria-label="Customer supplied"
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
                );
              })}
              <tr>
                <td colSpan={5} className="py-2 pr-2 text-right text-xs uppercase text-muted-foreground">
                  Items sub total
                </td>
                <td className="py-2 px-2 text-right tabular-nums font-semibold">
                  {formatMoney(total)}
                </td>
                <td />
              </tr>
              {exempt > 0 && (
                <tr>
                  <td colSpan={5} className="py-1 pr-2 text-right text-[11px] text-muted-foreground">
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

      <DuplicateConfirmDialog
        pending={pending}
        onConfirm={confirmPending}
        onDecline={declinePending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function DuplicateConfirmDialog({
  pending,
  onConfirm,
  onDecline,
  onCancel,
}: {
  pending: PendingAdd;
  onConfirm: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  if (!pending) return null;

  const isPart = pending.kind === "part";
  const title = isPart
    ? "Part already on this job"
    : "Package contains parts already on this job";

  let description: React.ReactNode;
  if (isPart) {
    const p = pending.part;
    const dupPrice = p.duplicate_unit_price != null ? formatMoney(p.duplicate_unit_price) : null;
    description = (
      <>
        <strong>
          {p.brand} {p.part_number}
        </strong>{" "}
        is already on this job. Adding it again will use{" "}
        {dupPrice ? (
          <>the duplicate price <strong>{dupPrice}</strong></>
        ) : (
          <>the list price (no duplicate price set)</>
        )}.
      </>
    );
  } else {
    const dupes = pending.pkg.items.filter(
      (it) => it.part_id != null && pending.dupePartIds.has(it.part_id),
    );
    description = (
      <>
        These parts in <strong>{pending.pkg.name}</strong> are already on this job:
        <ul className="list-disc pl-5 mt-2 space-y-0.5 text-sm">
          {dupes.map((it) => (
            <li key={it.id}>
              {it.part?.brand} {it.part?.part_number}
              {it.part?.duplicate_unit_price != null && (
                <span className="text-muted-foreground">
                  {" "}
                  · duplicate price {formatMoney(it.part.duplicate_unit_price)}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          Add the duplicates anyway, or skip them and add the rest of the package?
        </p>
      </>
    );
  }

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isPart ? (
            <>
              <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>Add anyway</AlertDialogAction>
            </>
          ) : (
            <>
              <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
              <Button type="button" variant="outline" onClick={onDecline}>
                Skip duplicates
              </Button>
              <AlertDialogAction onClick={onConfirm}>Add all</AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
