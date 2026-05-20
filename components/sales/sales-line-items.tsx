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
import type {
  Part,
  PartPackageItemRow,
  PartPackageWithItems,
  UnitOfMeasure,
} from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import {
  effectiveCatalogPriceForItem,
  effectiveLockedPriceForItem,
  isPartPackageLocked,
} from "@/lib/utils/package-pricing";
import { excelOilLabel } from "@/lib/utils/oil-labels";

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
  /** Category id of the linked part — used for same-category dup detection. */
  part_category_id?: string | null;
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
    part_category_id: null,
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

/**
 * One same-category collision between an item already on the job and a
 * part-row inside the package the user just dropped.
 */
type CategoryMatch = {
  /** key of the existing job line being upcharged. */
  existingKey: string;
  /** Snapshot of the existing row label (for the dialog). */
  existingLabel: string;
  /** The package item that triggered the match. */
  pkgItem: PartPackageItemRow;
  /** parts.extra_price — signed delta to apply to the existing line. */
  delta: number;
};

type PendingAdd =
  | {
      kind: "package";
      pkg: PartPackageWithItems;
      matches: CategoryMatch[];
    }
  | {
      kind: "picker";
      part: Part;
      existing: LineItem;
      delta: number;
    };

export function SalesLineItems({
  items,
  onChange,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}) {
  const [pending, setPending] = useState<PendingAdd | null>(null);

  const update = (key: string, patch: Partial<LineItem>) => {
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const remove = (key: string) => onChange(items.filter((it) => it.key !== key));
  const addCustom = () => onChange([...items, newLineItem()]);

  const lineFromPart = (p: Part): LineItem =>
    newLineItem({
      part_id: p.id,
      description: `${p.brand} ${p.part_number}${p.description ? ` — ${p.description}` : ""}`,
      quantity: 1,
      unit_price: Number(p.list_price) || 0,
      is_taxable: p.is_taxable,
      unit_of_measure: p.unit_of_measure,
      part_category_id: p.category_id,
    });

  const addPart = (p: Part) => {
    // If the picked part shares a category with an existing line, prompt.
    const existing = items.find(
      (it) => it.part_category_id != null && it.part_category_id === p.category_id,
    );
    if (existing) {
      setPending({
        kind: "picker",
        part: p,
        existing,
        delta: Number(p.extra_price ?? 0),
      });
      return;
    }
    onChange([...items, lineFromPart(p)]);
  };

  const buildPackageRows = (
    pkg: PartPackageWithItems,
    skipPkgItemIds: Set<string>,
  ): LineItem[] => {
    const locked = isPartPackageLocked(pkg);
    const rows: LineItem[] = [];
    for (const it of pkg.items) {
      if (skipPkgItemIds.has(it.id)) continue;

      let price: number;
      let description: string;
      let isTaxable: boolean;
      let unitOfMeasure: LineItem["unit_of_measure"];
      let categoryId: string | null;
      if (it.oil_type_id && it.oil_type) {
        price = locked
          ? effectiveLockedPriceForItem(it)
          : effectiveCatalogPriceForItem(it);
        const litres = Number(it.litres ?? 0);
        description = `${excelOilLabel(it.oil_type.code, it.oil_type.name)}${
          it.oil_container ? ` (${it.oil_container})` : ""
        }${litres ? ` × ${litres}L` : ""}`;
        isTaxable = it.oil_type.is_taxable;
        unitOfMeasure = "ltr";
        categoryId = null;
      } else if (it.part) {
        price = locked
          ? effectiveLockedPriceForItem(it)
          : effectiveCatalogPriceForItem(it);
        description = `${it.part.brand} ${it.part.part_number}${
          it.part.description ? ` — ${it.part.description}` : ""
        }`;
        isTaxable = it.part.is_taxable;
        unitOfMeasure = it.part.unit_of_measure;
        categoryId = it.part.category_id ?? null;
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
          part_category_id: categoryId,
        }),
      );
    }

    // Labor line — added once per package, regardless of duplicates.
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

  const findCategoryMatches = (pkg: PartPackageWithItems): CategoryMatch[] => {
    // Build "first existing line per category" so each existing line is
    // upcharged at most once even if the package has multiple items in the
    // same category.
    const claimedKeys = new Set<string>();
    const matches: CategoryMatch[] = [];
    for (const pkgItem of pkg.items) {
      if (!pkgItem.part || !pkgItem.part.category_id) continue;
      const cat = pkgItem.part.category_id;
      const existing = items.find(
        (it) =>
          it.part_category_id != null &&
          it.part_category_id === cat &&
          !claimedKeys.has(it.key),
      );
      if (!existing) continue;
      claimedKeys.add(existing.key);
      matches.push({
        existingKey: existing.key,
        existingLabel: existing.description || "(no description)",
        pkgItem,
        delta: Number(pkgItem.part.extra_price ?? 0),
      });
    }
    return matches;
  };

  const addPackage = (pkg: PartPackageWithItems) => {
    const matches = findCategoryMatches(pkg);
    if (matches.length > 0) {
      setPending({ kind: "package", pkg, matches });
      return;
    }
    onChange([...items, ...buildPackageRows(pkg, new Set())]);
  };

  const bumpExisting = (key: string, delta: number) =>
    items.map((it) => {
      if (it.key !== key || delta === 0) return it;
      const newPrice = Math.max(
        0,
        Math.round((Number(it.unit_price) + delta) * 100) / 100,
      );
      return { ...it, unit_price: newPrice };
    });

  /**
   * Primary action.
   * - Package: apply each match's delta to its existing line; skip those package items.
   * - Picker: apply delta to the existing line; do NOT add a new line.
   */
  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === "package") {
      const skip = new Set<string>(pending.matches.map((m) => m.pkgItem.id));
      const deltaByKey = new Map<string, number>();
      for (const m of pending.matches) {
        const prev = deltaByKey.get(m.existingKey) ?? 0;
        deltaByKey.set(m.existingKey, prev + m.delta);
      }
      const adjusted = items.map((it) => {
        const d = deltaByKey.get(it.key);
        if (d == null || d === 0) return it;
        const newPrice = Math.max(0, Math.round((Number(it.unit_price) + d) * 100) / 100);
        return { ...it, unit_price: newPrice };
      });
      onChange([...adjusted, ...buildPackageRows(pending.pkg, skip)]);
    } else {
      onChange(bumpExisting(pending.existing.key, pending.delta));
    }
    setPending(null);
  };

  /**
   * Secondary action.
   * - Package: skip the matched package items entirely; don't touch existing lines.
   * - Picker: add the new part as a separate line at list price.
   */
  const declinePending = () => {
    if (!pending) return;
    if (pending.kind === "package") {
      const skip = new Set<string>(pending.matches.map((m) => m.pkgItem.id));
      onChange([...items, ...buildPackageRows(pending.pkg, skip)]);
    } else {
      onChange([...items, lineFromPart(pending.part)]);
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
                          {it.package_label ? (
                            <span className="italic">from {it.package_label}</span>
                          ) : (
                            it.part_id && <span>From catalog</span>
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

      <CategoryDuplicateDialog
        pending={pending}
        onConfirm={confirmPending}
        onDecline={declinePending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function CategoryDuplicateDialog({
  pending,
  onConfirm,
  onDecline,
  onCancel,
}: {
  pending: PendingAdd | null;
  onConfirm: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  if (!pending) return null;

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <AlertDialogContent>
        {pending.kind === "package" ? (
          <PackageDupBody pending={pending} />
        ) : (
          <PickerDupBody pending={pending} />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          {pending.kind === "package" ? (
            <>
              <Button type="button" variant="outline" onClick={onDecline}>
                Skip duplicates
              </Button>
              <AlertDialogAction onClick={onConfirm}>
                Apply deltas
              </AlertDialogAction>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onDecline}>
                Add as separate line
              </Button>
              {pending.delta !== 0 && (
                <AlertDialogAction onClick={onConfirm}>
                  Apply {pending.delta > 0 ? "+" : ""}
                  {formatMoney(pending.delta)} to existing
                </AlertDialogAction>
              )}
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PackageDupBody({
  pending,
}: {
  pending: Extract<PendingAdd, { kind: "package" }>;
}) {
  const totalDelta =
    Math.round(
      pending.matches.reduce(
        (s, m) => s + (Number.isFinite(m.delta) ? m.delta : 0),
        0,
      ) * 100,
    ) / 100;

  return (
    <AlertDialogHeader>
      <AlertDialogTitle>
        Same-category parts already on this job
      </AlertDialogTitle>
      <AlertDialogDescription asChild>
        <div className="space-y-2 text-sm">
          <p>
            <strong>{pending.pkg.name}</strong> contains parts in the same
            category as lines already on this job. Apply the extra-price delta
            to the existing line (recommended for variant upgrades), or skip the
            package&rsquo;s same-category items entirely.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {pending.matches.map((m) => (
              <li key={m.pkgItem.id}>
                <strong>{m.existingLabel}</strong> ←{" "}
                {m.pkgItem.part?.brand} {m.pkgItem.part?.part_number}{" "}
                <span
                  className={
                    m.delta > 0
                      ? "text-rose-600"
                      : m.delta < 0
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                  }
                >
                  ({m.delta > 0 ? "+" : ""}
                  {formatMoney(m.delta)})
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Net change to existing lines if applied:{" "}
            <span
              className={
                totalDelta > 0
                  ? "text-rose-600"
                  : totalDelta < 0
                  ? "text-emerald-600"
                  : ""
              }
            >
              {totalDelta > 0 ? "+" : ""}
              {formatMoney(totalDelta)}
            </span>
            . The remaining (non-matching) package items and labor are added
            either way.
          </p>
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
  );
}

function PickerDupBody({
  pending,
}: {
  pending: Extract<PendingAdd, { kind: "picker" }>;
}) {
  const p = pending.part;
  return (
    <AlertDialogHeader>
      <AlertDialogTitle>Same-category part already on this job</AlertDialogTitle>
      <AlertDialogDescription asChild>
        <div className="space-y-2 text-sm">
          <p>
            <strong>
              {p.brand} {p.part_number}
            </strong>{" "}
            is the same category as{" "}
            <strong>{pending.existing.description || "an existing line"}</strong>
            .
          </p>
          {pending.delta !== 0 ? (
            <p>
              Apply{" "}
              <span
                className={pending.delta > 0 ? "text-rose-600" : "text-emerald-600"}
              >
                {pending.delta > 0 ? "+" : ""}
                {formatMoney(pending.delta)}
              </span>{" "}
              to the existing line (variant upgrade/credit), or add{" "}
              {p.brand} {p.part_number} as a separate line at{" "}
              {formatMoney(Number(p.list_price) || 0)}.
            </p>
          ) : (
            <p className="text-muted-foreground">
              No extra-price delta is set on this part — choose whether to add
              it as a separate line anyway.
            </p>
          )}
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
  );
}
