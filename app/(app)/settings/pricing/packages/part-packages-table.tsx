"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Lock, Pencil, Plus, Unlock } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  togglePartPackageActive,
  unlockPartPackage,
} from "@/lib/actions/pricing";
import type { PartPackageItemRow, PartPackageWithItems } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import {
  effectiveCatalogPriceForItem,
  effectiveLockedPriceForItem,
  isPartPackageLocked,
  packageCatalogItemsTotal,
  packageLockedItemsTotal,
} from "@/lib/utils/package-pricing";

import { LockPackageDialog } from "./lock-package-dialog";
import { MergePricesDialog } from "./merge-prices-dialog";
import { PartPackageFormDialog } from "./part-package-form-dialog";

// Item #20 — packages grid showing rolled-up cost / list / profit / margin.
//
// Cost = sum(parts.cost + parts.mhsw_fee) × quantity for part rows,
//        plus oil-type rate × litres for oil-typed rows (rate matches the
//        oil grid so package totals reconcile with the grid).
//        Labor is treated as pure margin — no internal cost is tracked.
// List = sum(unit_price override OR parts.list_price OR computed oil price)
//        × quantity, plus pkg.labor_selling_price (the labor charge).
// While locked, List uses locked_unit_price snapshots and labor_locked_selling_price.
// Profit = List - Cost (so the labor charge flows through as profit).

function lineCost(it: PartPackageItemRow): number {
  const qty = Number(it.quantity) || 0;
  if (it.part) return (Number(it.part.cost) + Number(it.part.mhsw_fee)) * qty;
  if (it.oil_type) {
    const lpg = Number(it.oil_type.litres_per_gallon) || 4.546;
    const ratePerLitre =
      it.oil_container === "gallon"
        ? Number(it.oil_type.gallon_cost_per_litre) / lpg
        : Number(it.oil_type.bulk_cost_per_litre);
    const litres = Number(it.litres ?? 0);
    return ratePerLitre * litres * qty;
  }
  return 0;
}

function rollUp(pkg: PartPackageWithItems): {
  cost: number;
  list: number;
  catalogList: number;
} {
  const itemsCost = pkg.items.reduce((sum, it) => sum + lineCost(it), 0);
  const itemsList = isPartPackageLocked(pkg)
    ? packageLockedItemsTotal(pkg.items)
    : packageCatalogItemsTotal(pkg.items);
  const labor = Number(pkg.labor_selling_price) || 0;
  const laborEff =
    isPartPackageLocked(pkg) && pkg.labor_locked_selling_price != null
      ? Number(pkg.labor_locked_selling_price)
      : labor;
  return {
    cost: itemsCost,
    list: itemsList + laborEff,
    catalogList: packageCatalogItemsTotal(pkg.items) + labor,
  };
}

function summarise(pkg: PartPackageWithItems): string {
  if (pkg.items.length === 0) return "(no parts)";
  const max = 3;
  const head = pkg.items
    .slice(0, max)
    .map((it) => {
      const qty = Number(it.quantity);
      if (it.part) return `${qty}× ${it.part.brand} ${it.part.part_number}`;
      if (it.oil_type) return `${qty}× ${it.oil_type.code} (oil)`;
      return `${qty}× —`;
    })
    .join(", ");
  return pkg.items.length > max ? `${head}, +${pkg.items.length - max} more` : head;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function PartPackagesTable({
  packages,
  isOwner,
}: {
  packages: PartPackageWithItems[];
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState<PartPackageWithItems | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [locking, setLocking] = useState<PartPackageWithItems | null>(null);
  const [merging, setMerging] = useState<PartPackageWithItems | null>(null);
  const [, startTransition] = useTransition();

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleToggle = (p: PartPackageWithItems) => {
    setPendingId(p.id);
    startTransition(async () => {
      const res = await togglePartPackageActive({ id: p.id, active: !p.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Package activated" : "Package deactivated");
    });
  };

  const handleUnlock = (p: PartPackageWithItems) => {
    setPendingId(p.id);
    startTransition(async () => {
      const res = await unlockPartPackage({ id: p.id });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success("Package unlocked");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New package
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Name</TableHead>
              <TableHead>Contents</TableHead>
              <TableHead className="w-20 text-right">Items</TableHead>
              {isOwner && <TableHead className="w-24 text-right">Cost</TableHead>}
              <TableHead className="w-24 text-right">List</TableHead>
              {isOwner && <TableHead className="w-24 text-right">Profit</TableHead>}
              {isOwner && <TableHead className="w-20 text-right">Margin</TableHead>}
              <TableHead className="w-32">Lock</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-56 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOwner ? 11 : 8} className="text-center text-muted-foreground py-8">
                  No packages yet. Click <strong>New package</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((p) => {
                const { cost, list, catalogList } = rollUp(p);
                const profit = list - cost;
                const marginPct = list > 0 ? ((list - cost) / list) * 100 : null;
                const locked = isPartPackageLocked(p);
                const drift = locked ? Math.round((catalogList - list) * 100) / 100 : 0;
                const isOpen = expanded.has(p.id);
                return (
                  <Fragment key={p.id}>
                    <TableRow className={!p.active ? "opacity-60" : undefined}>
                      <TableCell className="align-top p-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => toggleExpand(p.id)}
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium align-top">
                        {p.name}
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground align-top">
                        {summarise(p)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top">
                        {p.items.length}
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right tabular-nums align-top text-muted-foreground">
                          {formatMoney(cost)}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums align-top font-medium">
                        {formatMoney(list)}
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right tabular-nums align-top">
                          <span className={profit < 0 ? "text-rose-600" : undefined}>
                            {formatMoney(profit)}
                          </span>
                        </TableCell>
                      )}
                      {isOwner && (
                        <TableCell className="text-right tabular-nums align-top">
                          {marginPct == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={marginPct < 15 ? "text-rose-600" : undefined}>
                              {marginPct.toFixed(1)}%
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="align-top">
                        {locked ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" className="gap-1 w-fit">
                              <Lock className="size-3" />
                              {daysUntil(p.lock_until!)}d
                            </Badge>
                            {drift !== 0 && (
                              <span
                                className={`text-[10px] tabular-nums ${
                                  drift > 0 ? "text-rose-600" : "text-emerald-600"
                                }`}
                              >
                                {drift > 0 ? "↑" : "↓"} {formatMoney(Math.abs(drift))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={p.active ? "default" : "secondary"}>
                          {p.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(p)}
                            disabled={locked}
                            title={locked ? "Unlock to edit" : "Edit"}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {locked ? (
                            <>
                              {drift !== 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setMerging(p)}
                                >
                                  Review prices…
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pendingId === p.id}
                                onClick={() => handleUnlock(p)}
                              >
                                <Unlock className="size-4" /> Unlock
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocking(p)}
                            >
                              <Lock className="size-4" /> Lock…
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pendingId === p.id}
                            onClick={() => handleToggle(p)}
                          >
                            {p.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={isOwner ? 11 : 8} className="p-0">
                          <PackageBreakdown pkg={p} isOwner={isOwner} locked={locked} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PartPackageFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
      />
      <PartPackageFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        pkg={editing ?? undefined}
      />
      <LockPackageDialog
        open={locking !== null}
        onOpenChange={(open) => !open && setLocking(null)}
        pkg={locking ?? undefined}
      />
      <MergePricesDialog
        open={merging !== null}
        onOpenChange={(open) => !open && setMerging(null)}
        pkg={merging ?? undefined}
      />
    </>
  );
}

function PackageBreakdown({
  pkg,
  isOwner,
  locked,
}: {
  pkg: PartPackageWithItems;
  isOwner: boolean;
  locked: boolean;
}) {
  const itemRows = pkg.items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const sellPerUnit = locked
      ? effectiveLockedPriceForItem(it)
      : effectiveCatalogPriceForItem(it);
    const costPerUnit = lineCost(it) / (qty || 1);
    const lineSell = sellPerUnit * qty;
    const lineCostTotal = costPerUnit * qty;
    return {
      key: it.id,
      label: it.part
        ? `${it.part.brand} ${it.part.part_number}${it.part.description ? ` — ${it.part.description}` : ""}`
        : it.oil_type
        ? `${it.oil_type.code} — ${it.oil_type.name}${it.oil_container ? ` (${it.oil_container})` : ""}${it.litres ? ` × ${it.litres}L` : ""}`
        : "—",
      qty,
      uom: it.part?.unit_of_measure ?? (it.oil_type ? "ltr" : "—"),
      costPerUnit,
      sellPerUnit,
      lineCostTotal,
      lineSell,
      lineProfit: lineSell - lineCostTotal,
    };
  });

  const laborSell =
    locked && pkg.labor_locked_selling_price != null
      ? Number(pkg.labor_locked_selling_price)
      : Number(pkg.labor_selling_price) || 0;

  const totalSell =
    itemRows.reduce((s, r) => s + r.lineSell, 0) + laborSell;
  const totalCost = itemRows.reduce((s, r) => s + r.lineCostTotal, 0);

  return (
    <div className="px-6 py-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase text-muted-foreground border-b">
            <th className="text-left font-medium py-1.5 pr-2">Item</th>
            <th className="text-right font-medium py-1.5 px-2 w-16">Qty</th>
            {isOwner && <th className="text-right font-medium py-1.5 px-2 w-20">Unit cost</th>}
            <th className="text-right font-medium py-1.5 px-2 w-20">Unit sell</th>
            {isOwner && <th className="text-right font-medium py-1.5 px-2 w-24">Line cost</th>}
            <th className="text-right font-medium py-1.5 px-2 w-24">Line sell</th>
            {isOwner && <th className="text-right font-medium py-1.5 px-2 w-24">Line profit</th>}
          </tr>
        </thead>
        <tbody>
          {itemRows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="py-1.5 pr-2">{r.label}</td>
              <td className="text-right tabular-nums py-1.5 px-2">
                {r.qty}
                <span className="text-[10px] uppercase text-muted-foreground ml-1">{r.uom}</span>
              </td>
              {isOwner && (
                <td className="text-right tabular-nums py-1.5 px-2 text-muted-foreground">
                  {formatMoney(r.costPerUnit)}
                </td>
              )}
              <td className="text-right tabular-nums py-1.5 px-2">{formatMoney(r.sellPerUnit)}</td>
              {isOwner && (
                <td className="text-right tabular-nums py-1.5 px-2 text-muted-foreground">
                  {formatMoney(r.lineCostTotal)}
                </td>
              )}
              <td className="text-right tabular-nums py-1.5 px-2">{formatMoney(r.lineSell)}</td>
              {isOwner && (
                <td className="text-right tabular-nums py-1.5 px-2">
                  <span className={r.lineProfit < 0 ? "text-rose-600" : undefined}>
                    {formatMoney(r.lineProfit)}
                  </span>
                </td>
              )}
            </tr>
          ))}
          {laborSell > 0 && (
            <tr className="border-b last:border-0 bg-amber-50/50 dark:bg-amber-950/20">
              <td className="py-1.5 pr-2 font-medium">
                {pkg.labor_description ?? "Labor"}
              </td>
              <td className="text-right tabular-nums py-1.5 px-2">
                1<span className="text-[10px] uppercase text-muted-foreground ml-1">each</span>
              </td>
              {isOwner && (
                <td className="text-right tabular-nums py-1.5 px-2 text-muted-foreground">—</td>
              )}
              <td className="text-right tabular-nums py-1.5 px-2">{formatMoney(laborSell)}</td>
              {isOwner && (
                <td className="text-right tabular-nums py-1.5 px-2 text-muted-foreground">—</td>
              )}
              <td className="text-right tabular-nums py-1.5 px-2">{formatMoney(laborSell)}</td>
              {isOwner && (
                <td className="text-right tabular-nums py-1.5 px-2">
                  {formatMoney(laborSell)}
                </td>
              )}
            </tr>
          )}
          <tr className="font-semibold">
            <td className="py-1.5 pr-2 text-right" colSpan={isOwner ? 4 : 3}>
              Totals
            </td>
            {isOwner && (
              <td className="text-right tabular-nums py-1.5 px-2">
                {formatMoney(totalCost)}
              </td>
            )}
            <td className="text-right tabular-nums py-1.5 px-2">
              {formatMoney(totalSell)}
            </td>
            {isOwner && (
              <td className="text-right tabular-nums py-1.5 px-2">
                <span className={totalSell - totalCost < 0 ? "text-rose-600" : undefined}>
                  {formatMoney(totalSell - totalCost)}
                </span>
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
