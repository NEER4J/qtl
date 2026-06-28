"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";

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
import { ServiceCostPickerButton } from "@/components/pricing/service-cost-picker";
import {
  TransServicePickerButton,
  transServiceLabel,
  transServicePrice,
} from "@/components/pricing/trans-service-picker";
import { OilPickerButton, type OilContainer } from "@/components/sales/oil-picker-button";
import { PackagePickerButton } from "@/components/sales/package-picker-button";
import type { PartForPicker, TransmissionService } from "@/lib/actions/pricing";
import type {
  OilType,
  Part,
  PartPackageWithItems,
  ServiceCost,
  UnitOfMeasure,
} from "@/lib/db/types";
import { formatMoney, roundUpTo99 } from "@/lib/utils/format";
import {
  effectiveCatalogPriceForItem,
  effectiveLockedPriceForItem,
  isPartPackageLocked,
} from "@/lib/utils/package-pricing";
import { excelOilLabel } from "@/lib/utils/oil-labels";
import { buildDisplayRows, packageGroupKey } from "@/lib/utils/sales-display";

export interface LineItem {
  /** Local key for React; not persisted. */
  key: string;
  /** Set if linked to a catalog part; null for custom rows. */
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  /** Per-unit Sell MHSW for the linked part (already inside unit_price); shown
   *  as the MHSW column. 0 for non-part / labour / package-collapsed lines. */
  mhsw_unit?: number;
  /** Whether this line contributes to the HST taxable subtotal. Defaults true. */
  is_taxable: boolean;
  /** Unit label shown beside qty ("3 ltr"). null for custom rows. */
  unit_of_measure: UnitOfMeasure | null;
  /** Snapshot of the package this row was expanded from; null for individual lines. */
  package_label?: string | null;
  /** Per-instance group id shared by every row from one package expansion, so
   *  the package collapses to a single display line. Null for individual lines. */
  package_group?: string | null;
  /** True when the customer brought the part themselves; line_total forced to 0. */
  is_customer_supplied?: boolean;
  /** Category id of the linked part — used for same-category dup detection. */
  part_category_id?: string | null;
  /** Oil type this line came from (package oil item) — for overlap detection. */
  oil_type_id?: string | null;
  /** Bulk (litres) vs gallon container for an oil line — drives the "ltr"/"gal" unit label. */
  oil_container?: "bulk" | "gallon" | null;
  /** Trans & Diff service this line came from — for overlap detection. */
  transmission_service_id?: string | null;
  /** When set, this is a merged duplicate billed at $0; value is the waived unit price. */
  merged_unit_price?: number | null;
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
    mhsw_unit: 0,
    is_taxable: true,
    unit_of_measure: null,
    package_label: null,
    package_group: null,
    is_customer_supplied: false,
    part_category_id: null,
    oil_type_id: null,
    oil_container: null,
    transmission_service_id: null,
    merged_unit_price: null,
    ...partial,
  };
}

/** Generate a fresh package-instance group id. */
function newGroupId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `grp-${Math.random().toString(36).slice(2)}`;
}

/**
 * Price input that tolerates an in-progress "-" or "" so a NEGATIVE price (a
 * return / credit line) can be typed. A plain controlled number input snapped
 * the lone "-" back to 0 (Number("-") → NaN → 0), so the minus could never be
 * entered. This keeps a local text buffer and emits the parsed number.
 */
function SignedPriceInput({
  value,
  onValueChange,
  className,
}: {
  value: number;
  onValueChange: (n: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => String(value));
  const lastEmitted = useRef(value);
  // Re-sync only when the value changes from OUTSIDE this input (e.g. a tier add),
  // never when it equals what we last emitted — which would wipe an in-progress "-".
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(String(value));
    }
  }, [value]);
  return (
    <Input
      type="number"
      step="0.01"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = raw === "" || raw === "-" || raw === "-." || raw === "." ? 0 : Number(raw);
        const next = Number.isFinite(n) ? n : 0;
        lastEmitted.current = next;
        onValueChange(next);
      }}
      className={className}
    />
  );
}

/** Unit label for a line — oils show "gal" vs "ltr" based on the chosen container. */
function displayUnit(it: LineItem): string | null {
  if (it.oil_container === "gallon") return "gal";
  return it.unit_of_measure;
}

/** Raw line total (qty × unit), with NO .99 rounding. */
function rawLineTotal(item: LineItem): number {
  if (item.is_customer_supplied) return 0;
  const q = Number(item.quantity);
  const p = Number(item.unit_price);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return Math.round(q * p * 100) / 100;
}

/** Display / charge total for ONE line = qty × unit price (no rounding). */
export function lineItemTotal(item: LineItem): number {
  return rawLineTotal(item);
}

/** A package's total = the raw sum of its item line totals. */
export function packageDisplayTotal(rawSum: number): number {
  return rawSum;
}

/** Sub total = the sum of every line's raw total. */
export function lineItemsSubTotal(items: LineItem[]): number {
  const total = items.reduce((s, it) => s + rawLineTotal(it), 0);
  return Math.round(total * 100) / 100;
}

/** HST base — the sum of the taxable lines' raw totals. */
export function lineItemsTaxableSubTotal(items: LineItem[]): number {
  const total = items.reduce((s, it) => (it.is_taxable ? s + rawLineTotal(it) : s), 0);
  return Math.round(total * 100) / 100;
}

/**
 * One overlap between an item already on the job and an item inside the package
 * the user just dropped — same part category, same oil, or same Trans & Diff
 * service. Used to offer "Merge" (drop the duplicate) vs "Add separately".
 */
type Overlap = {
  /** id of the package item that duplicates something already on the job. */
  pkgItemId: string;
  /** Label of the package item (what would be dropped on Merge). */
  itemLabel: string;
  /** Label of the existing job line it duplicates. */
  existingLabel: string;
};

type PendingAdd =
  | {
      kind: "package";
      pkg: PartPackageWithItems;
      overlaps: Overlap[];
    }
  | {
      // Single part picked from the catalogue — ask which price tier to charge
      // (With Service / Without Service / Over Counter). `existing` is the
      // same-category line already on the job (if any), so we can still offer
      // the package upgrade/credit shortcut. `delta` = part.extra_price.
      kind: "tier";
      part: PartForPicker;
      existing: LineItem | null;
      delta: number;
    };

export function SalesLineItems({
  items,
  onChange,
  serviceCosts = [],
  oilTypes = [],
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  /** Service (labour) costs catalogue — pickable as job lines. */
  serviceCosts?: ServiceCost[];
  /** Oil grades — pickable as standalone oil line items. */
  oilTypes?: OilType[];
}) {
  const [pending, setPending] = useState<PendingAdd | null>(null);
  // Re-entry guard: a fast double-click on a dialog's confirm button could fire
  // its handler twice before the dialog closes, adding the item(s) twice. The
  // guard is set on confirm and reset only when a new dialog is opened.
  const addingRef = useRef(false);

  const update = (key: string, patch: Partial<LineItem>) => {
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const remove = (key: string) => onChange(items.filter((it) => it.key !== key));
  /** Remove every line belonging to one collapsed package instance. */
  const removeGroup = (groupKey: string) =>
    onChange(items.filter((it) => packageGroupKey(it) !== groupKey));

  /**
   * Remove a single item from a package WITHOUT dropping the package total — the
   * removed item's value is absorbed into the first remaining item of the same
   * package, so the bundle price stays the same (a package is a fixed-price
   * deal). If it was the last item, the whole package goes.
   */
  const removeFromPackageKeepingTotal = (item: LineItem) => {
    const groupKey = packageGroupKey(item);
    const removedTotal = lineItemTotal(item);
    const rest = items.filter((it) => it.key !== item.key);
    const siblings = rest.filter((it) => packageGroupKey(it) === groupKey);
    if (siblings.length === 0) {
      onChange(rest);
      return;
    }
    const anchorKey = siblings[0]!.key;
    onChange(
      rest.map((it) => {
        if (it.key !== anchorKey) return it;
        const qty = Number(it.quantity) || 1;
        const newUnit =
          Math.round((Number(it.unit_price) + removedTotal / qty) * 100) / 100;
        return { ...it, unit_price: newUnit };
      }),
    );
  };
  const addCustom = () => onChange([...items, newLineItem()]);

  /** Add a free-form labour line (taxable, user fills the amount). */
  const addLabour = () =>
    onChange([...items, newLineItem({ description: "Labour", is_taxable: true })]);

  /** Drop a Service (labour) cost from the catalogue in as a taxable line at its cost. */
  const addServiceCost = (sc: ServiceCost) =>
    onChange([
      ...items,
      newLineItem({
        part_id: null,
        description: sc.name,
        quantity: 1,
        unit_price: Number(sc.cost) || 0,
        is_taxable: true,
      }),
    ]);

  /** Add an oil grade as a standalone line: qty = litres, price = per-litre rate
   *  (editable in the row). */
  const addOil = (oil: OilType, container: OilContainer) => {
    const rate =
      container === "gallon"
        ? Number(oil.gallon_cost_per_litre)
        : Number(oil.bulk_cost_per_litre);
    onChange([
      ...items,
      newLineItem({
        part_id: null,
        description: `${excelOilLabel(oil.code, oil.name)} (${container})`,
        quantity: 1,
        unit_price: Number.isFinite(rate) ? rate : 0,
        is_taxable: oil.is_taxable,
        unit_of_measure: "ltr",
        oil_type_id: oil.id,
        oil_container: container,
      }),
    ]);
  };

  const lineFromPart = (p: Part, unitPriceOverride?: number): LineItem => {
    const base = unitPriceOverride ?? (Number(p.list_price) || 0);
    return newLineItem({
      part_id: p.id,
      description: `${p.brand} ${p.part_number}${p.description ? ` — ${p.description}` : ""}`,
      quantity: 1,
      // Per-part opt-in: parts flagged `round_off` snap up to the next .99.
      unit_price: p.round_off ? roundUpTo99(base) : base,
      mhsw_unit: Number(p.mhsw_fee) || 0,
      is_taxable: p.is_taxable,
      unit_of_measure: p.unit_of_measure,
      part_category_id: p.category_id,
    });
  };

  /** Add a Trans & Diff service as a standalone taxable line (sell + labour). */
  const addTransService = (s: TransmissionService) =>
    onChange([
      ...items,
      newLineItem({
        part_id: null,
        description: transServiceLabel(s),
        quantity: 1,
        unit_price: transServicePrice(s),
        is_taxable: true,
        unit_of_measure: null,
        transmission_service_id: s.id,
      }),
    ]);

  /** Add a returned part as a negative (credit) line on a later invoice. The
   *  amount defaults to the list price as a credit; the user can edit it. */
  const addReturn = (p: PartForPicker) =>
    onChange([
      ...items,
      newLineItem({
        part_id: p.id,
        description: `${p.brand} ${p.part_number}${
          p.description ? ` — ${p.description}` : ""
        } (return)`,
        quantity: 1,
        unit_price: -(Number(p.list_price) || 0),
        is_taxable: p.is_taxable,
        unit_of_measure: p.unit_of_measure,
        part_category_id: p.category_id,
      }),
    ]);

  /**
   * A visible upgrade charge as its own line — e.g. "Upgrade: Cat 1R-0716".
   * `delta` must be positive; credits are handled by reducing the existing line
   * instead, because unit_price can't be negative.
   */
  const upgradeLine = (
    part: { brand: string; part_number: string; is_taxable?: boolean | null },
    delta: number,
  ): LineItem =>
    newLineItem({
      part_id: null,
      description: `Upgrade: ${part.brand} ${part.part_number}`,
      quantity: 1,
      unit_price: Math.round(delta * 100) / 100,
      is_taxable: part.is_taxable ?? true,
      unit_of_measure: null,
    });

  const addPart = (p: PartForPicker) => {
    // Every part add asks which price tier to charge (client 2026-06):
    // With Service / Without Service / Over Counter. We also surface the
    // same-category line already on the job (if any) so the package
    // upgrade/credit shortcut stays available.
    const existing =
      items.find(
        (it) => it.part_category_id != null && it.part_category_id === p.category_id,
      ) ?? null;
    addingRef.current = false;
    setPending({
      kind: "tier",
      part: p,
      existing,
      delta: Number(p.extra_price ?? 0),
    });
  };

  const buildPackageRows = (
    pkg: PartPackageWithItems,
    // Items to bring in as merged duplicates: kept visible but billed at $0,
    // with the waived price recorded for the "merged / saved" indicator.
    mergeItemIds: Set<string>,
  ): LineItem[] => {
    const locked = isPartPackageLocked(pkg);
    // One group id per expansion so the whole package collapses to one line,
    // and adding the same package twice stays as two independent lines.
    const groupId = newGroupId();
    const rows: LineItem[] = [];
    for (const it of pkg.items) {
      let price: number;
      let description: string;
      let isTaxable: boolean;
      let unitOfMeasure: LineItem["unit_of_measure"];
      let categoryId: string | null = null;
      let oilTypeId: string | null = null;
      let oilContainer: "bulk" | "gallon" | null = null;
      let transId: string | null = null;
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
        oilTypeId = it.oil_type_id;
        oilContainer = it.oil_container ?? null;
      } else if (it.transmission_service_id && it.transmission_service) {
        price = locked
          ? effectiveLockedPriceForItem(it)
          : effectiveCatalogPriceForItem(it);
        const s = it.transmission_service;
        const syn =
          s.service_kind === "coolant_flush" ? "" : s.is_synthetic ? " (Syn)" : " (Reg)";
        description = `${s.name}${syn}`;
        isTaxable = true; // services are HST-taxable
        unitOfMeasure = null;
        transId = it.transmission_service_id;
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
      const basePrice = Number.isFinite(price) ? price : 0;
      const merged = mergeItemIds.has(it.id);
      rows.push(
        newLineItem({
          part_id: it.part_id ?? null,
          description,
          quantity: Number(it.quantity) || 1,
          // Merged duplicates are billed at $0; their waived price is kept for
          // the indicator.
          unit_price: merged ? 0 : basePrice,
          merged_unit_price: merged ? basePrice : null,
          is_taxable: merged ? false : isTaxable,
          unit_of_measure: unitOfMeasure,
          package_label: pkg.name,
          package_group: groupId,
          part_category_id: categoryId,
          oil_type_id: oilTypeId,
          oil_container: oilContainer,
          transmission_service_id: transId,
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
          package_group: groupId,
        }),
      );
    }
    return rows;
  };

  /**
   * Find items in `pkg` that duplicate something already on the job — by part
   * category, oil type, or Trans & Diff service. Each existing line is claimed
   * at most once so two package items don't both point at the same line.
   */
  const findPackageOverlaps = (pkg: PartPackageWithItems): Overlap[] => {
    const claimedKeys = new Set<string>();
    const overlaps: Overlap[] = [];
    for (const pkgItem of pkg.items) {
      let match: ((it: LineItem) => boolean) | null = null;
      let itemLabel = "";
      if (pkgItem.part && pkgItem.part.category_id) {
        const cat = pkgItem.part.category_id;
        match = (it) => it.part_category_id != null && it.part_category_id === cat;
        itemLabel = `${pkgItem.part.brand} ${pkgItem.part.part_number}`;
      } else if (pkgItem.oil_type_id) {
        const oid = pkgItem.oil_type_id;
        match = (it) => it.oil_type_id === oid;
        itemLabel = pkgItem.oil_type
          ? excelOilLabel(pkgItem.oil_type.code, pkgItem.oil_type.name)
          : "oil";
      } else if (pkgItem.transmission_service_id) {
        const sid = pkgItem.transmission_service_id;
        match = (it) => it.transmission_service_id === sid;
        itemLabel = pkgItem.transmission_service?.name ?? "service";
      }
      if (!match) continue;
      const existing = items.find((it) => match!(it) && !claimedKeys.has(it.key));
      if (!existing) continue;
      claimedKeys.add(existing.key);
      overlaps.push({
        pkgItemId: pkgItem.id,
        itemLabel,
        existingLabel: existing.package_label
          ? `${existing.description || "item"} (from ${existing.package_label})`
          : existing.description || "(no description)",
      });
    }
    return overlaps;
  };

  const addPackage = (pkg: PartPackageWithItems) => {
    const overlaps = findPackageOverlaps(pkg);
    if (overlaps.length > 0) {
      addingRef.current = false;
      setPending({ kind: "package", pkg, overlaps });
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
   * Package "Merge": add the package but drop the overlapping items so the
   * duplicate isn't billed twice; the package total reflects only what's left.
   */
  const confirmPending = () => {
    if (!pending || pending.kind !== "package") return;
    if (addingRef.current) return;
    addingRef.current = true;
    const mergeIds = new Set<string>(pending.overlaps.map((o) => o.pkgItemId));
    onChange([...items, ...buildPackageRows(pending.pkg, mergeIds)]);
    setPending(null);
  };

  /**
   * Package "Add separately": add the package whole — both copies billed.
   */
  const declinePending = () => {
    if (!pending || pending.kind !== "package") return;
    if (addingRef.current) return;
    addingRef.current = true;
    onChange([...items, ...buildPackageRows(pending.pkg, new Set())]);
    setPending(null);
  };

  /** Tier dialog: add the picked part as a line at the chosen price tier. */
  const addPartAtPrice = (price: number) => {
    if (!pending || pending.kind !== "tier") return;
    if (addingRef.current) return;
    addingRef.current = true;
    onChange([...items, lineFromPart(pending.part, price)]);
    setPending(null);
  };

  /**
   * Tier dialog shortcut when the job already has a same-category line and the
   * part carries an extra_price: charge just the upgrade/credit instead of a
   * full line. Positive delta becomes its own line; negative reduces the
   * existing line (unit_price can't go negative).
   */
  const chargeUpgrade = () => {
    if (!pending || pending.kind !== "tier" || pending.delta === 0) return;
    if (addingRef.current) return;
    addingRef.current = true;
    if (pending.delta > 0) {
      onChange([...items, upgradeLine(pending.part, pending.delta)]);
    } else if (pending.existing) {
      onChange(bumpExisting(pending.existing.key, pending.delta));
    }
    setPending(null);
  };

  const total = lineItemsSubTotal(items);
  const taxable = lineItemsTaxableSubTotal(items);
  const exempt = Math.round((total - taxable) * 100) / 100;

  // Collapse each package instance into one read-only line; standalone lines
  // stay individually editable.
  const displayRows = buildDisplayRows(
    items,
    (it) => lineItemTotal(it),
    (it) => it.is_taxable === true,
    (it) => it.package_label ?? "Package",
  );

  const renderEditableRow = (it: LineItem) => {
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
          {(it.part_id || cs) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {it.part_id && <span>From catalog</span>}
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
            {displayUnit(it) && (
              <span className="text-[10px] uppercase text-muted-foreground w-10 text-left">
                {displayUnit(it)}
              </span>
            )}
          </div>
        </td>
        <td className="py-2 px-2 text-right">
          <SignedPriceInput
            value={it.unit_price}
            onValueChange={(n) => update(it.key, { unit_price: n })}
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
  };

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
              {displayRows.map((row) => {
                if (row.type === "single") return renderEditableRow(row.item);
                // Collapsed package — shown as one read-only line (name + total).
                // Price is fixed from the package definition; edit the package
                // in Settings to change it, or remove and re-add here.
                const mergedSaved = row.items.reduce(
                  (s, it) =>
                    s +
                    (it.merged_unit_price != null
                      ? Number(it.merged_unit_price) * (Number(it.quantity) || 1)
                      : 0),
                  0,
                );
                const mergedCount = row.items.filter(
                  (it) => it.merged_unit_price != null,
                ).length;
                return (
                  <Fragment key={row.key}>
                    {/* Package header — name + single total; price is fixed
                        from the package definition. */}
                    <tr className="align-top bg-muted/30">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <Boxes className="size-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{row.label}</span>
                          {mergedCount > 0 && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-500">
                              Merged · saved {formatMoney(mergedSaved)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Package · {row.items.length} item{row.items.length === 1 ? "" : "s"}
                          {mergedCount > 0 &&
                            ` · ${mergedCount} already on the job (not charged)`}
                        </p>
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground tabular-nums">1</td>
                      <td className="py-2 px-2" />
                      <td className="py-2 px-2 text-center text-[10px] uppercase text-muted-foreground">
                        {row.taxableTotal <= 0
                          ? "Exempt"
                          : row.taxableTotal >= row.total
                          ? "Yes"
                          : "Mixed"}
                      </td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium">
                        {formatMoney(packageDisplayTotal(row.total))}
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeGroup(row.key)}
                          aria-label="Remove package"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                    {/* Included items — name only; no per-item price/qty (the
                        package TOTAL is what's charged). Remove still keeps the
                        package total via removeFromPackageKeepingTotal. */}
                    {row.items.map((it, i) => {
                      const isMerged = it.merged_unit_price != null;
                      return (
                        <tr
                          key={it.key}
                          className={`align-top bg-muted/30 ${
                            i === row.items.length - 1 ? "border-b" : ""
                          }`}
                        >
                          <td className="py-1.5 pr-2 pl-9">
                            <span className="text-muted-foreground">{it.description}</span>
                            {displayUnit(it) && (
                              <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                                {Number(it.quantity)} {displayUnit(it)}
                              </span>
                            )}
                            {isMerged && (
                              <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-500">
                                · merged (already on the job)
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2" />
                          <td className="py-1.5 px-2 text-center text-[10px] uppercase text-muted-foreground">
                            {isMerged ? "" : "Included"}
                          </td>
                          <td className="py-1.5 px-2" />
                          <td className="py-1.5 px-2" />
                          <td className="py-1.5 px-2" />
                          <td className="py-1.5 pl-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeFromPackageKeepingTotal(it)}
                              aria-label="Remove item from package"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
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
        {oilTypes.length > 0 && <OilPickerButton oilTypes={oilTypes} onSelect={addOil} />}
        <TransServicePickerButton onSelect={addTransService} />
        {serviceCosts.length > 0 && (
          <ServiceCostPickerButton serviceCosts={serviceCosts} onSelect={addServiceCost} />
        )}
        <Button type="button" variant="outline" size="sm" onClick={addLabour}>
          <Plus className="size-4" /> Add labour
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          <Plus className="size-4" /> Add custom item
        </Button>
        <PartPickerButton onSelect={addReturn} label="Add return / credit" />
      </div>

      <CategoryDuplicateDialog
        pending={pending}
        onConfirm={confirmPending}
        onDecline={declinePending}
        onAddAtPrice={addPartAtPrice}
        onChargeUpgrade={chargeUpgrade}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function CategoryDuplicateDialog({
  pending,
  onConfirm,
  onDecline,
  onAddAtPrice,
  onChargeUpgrade,
  onCancel,
}: {
  pending: PendingAdd | null;
  onConfirm: () => void;
  onDecline: () => void;
  onAddAtPrice: (price: number) => void;
  onChargeUpgrade: () => void;
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
          <>
            <PackageDupBody pending={pending} />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
              <Button type="button" variant="outline" onClick={onDecline}>
                Add separately
              </Button>
              <AlertDialogAction onClick={onConfirm}>
                Merge (drop duplicates)
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <TierDialogBody
            pending={pending}
            onAddAtPrice={onAddAtPrice}
            onChargeUpgrade={onChargeUpgrade}
            onCancel={onCancel}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Tier picker shown on every single-part add — With Service / Without Service /
 * Over Counter. Prices come from the part's computed sell tiers; a bundled part
 * has With Service = $0 (the package covers it). When the
 * job already has a same-category line and the part has an extra_price, an
 * upgrade/credit shortcut is also offered.
 */
function TierDialogBody({
  pending,
  onAddAtPrice,
  onChargeUpgrade,
  onCancel,
}: {
  pending: Extract<PendingAdd, { kind: "tier" }>;
  onAddAtPrice: (price: number) => void;
  onChargeUpgrade: () => void;
  onCancel: () => void;
}) {
  const p = pending.part;
  const tiers: { key: string; label: string; price: number | null; hint?: string }[] = [
    {
      key: "with",
      label: "With Service",
      price: p.with_service,
      hint: p.in_package ? "bundled in a package" : undefined,
    },
    { key: "without", label: "Without Service", price: p.without_service },
    { key: "over", label: "Over the Counter", price: p.over_counter },
  ];
  // A tier with a computed price (incl. $0, e.g. a discounted With Service) is
  // selectable; only genuinely null tiers (no data) are unavailable.
  const anyTier = tiers.some((t) => t.price != null);
  const listPrice = Number(p.list_price) || 0;

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Add {p.brand} {p.part_number}
        </AlertDialogTitle>
        <AlertDialogDescription>
          Choose which price to charge.
          {pending.existing
            ? ` This job already has a similar part (${
                pending.existing.description || "a line already on the job"
              }).`
            : ""}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="grid gap-2">
        {tiers.map((t) => {
          const available = t.price != null;
          return (
            <Button
              key={t.key}
              type="button"
              variant="outline"
              disabled={!available}
              onClick={() => available && onAddAtPrice(t.price as number)}
              className="flex h-auto w-full items-center justify-between py-2"
            >
              <span className="text-left">
                {t.label}
                {t.hint ? (
                  <span className="ml-1 text-xs text-muted-foreground">· {t.hint}</span>
                ) : null}
              </span>
              <span className="tabular-nums font-medium">
                {available ? formatMoney(t.price as number) : "—"}
              </span>
            </Button>
          );
        })}
        {!anyTier && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onAddAtPrice(listPrice)}
            className="flex h-auto w-full items-center justify-between py-2"
          >
            <span>List price</span>
            <span className="tabular-nums font-medium">{formatMoney(listPrice)}</span>
          </Button>
        )}
      </div>

      {pending.delta !== 0 && pending.existing && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          This is{" "}
          {pending.delta > 0 ? "an upgrade over" : "cheaper than"}{" "}
          <strong>{pending.existing.description || "the part already on the job"}</strong>. Instead
          of a second line you can just adjust that line by{" "}
          <strong>
            {pending.delta > 0 ? "+" : ""}
            {formatMoney(pending.delta)}
          </strong>
          .
        </p>
      )}

      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
        {pending.delta !== 0 && (
          <Button type="button" variant="secondary" onClick={onChargeUpgrade}>
            {pending.delta > 0
              ? `Just charge the +${formatMoney(pending.delta)} upgrade`
              : `Just apply the ${formatMoney(pending.delta)} credit`}
          </Button>
        )}
      </AlertDialogFooter>
    </>
  );
}

function PackageDupBody({
  pending,
}: {
  pending: Extract<PendingAdd, { kind: "package" }>;
}) {
  return (
    <AlertDialogHeader>
      <AlertDialogTitle>Some items are already on this job</AlertDialogTitle>
      <AlertDialogDescription asChild>
        <div className="space-y-2 text-sm">
          <p>
            <strong>{pending.pkg.name}</strong> includes{" "}
            {pending.overlaps.length === 1 ? "an item" : "items"} the job already
            has:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {pending.overlaps.map((o) => (
              <li key={o.pkgItemId}>
                <strong>{o.itemLabel}</strong>
                <span className="text-muted-foreground">
                  {" "}
                  — already on the job as {o.existingLabel}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            <strong>Merge</strong> drops {pending.overlaps.length === 1 ? "it" : "these"}{" "}
            from the package so {pending.overlaps.length === 1 ? "it isn't" : "they aren't"}{" "}
            billed twice (the package total drops accordingly).{" "}
            <strong>Add separately</strong> brings the package in whole, charging
            for both.
          </p>
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
  );
}

