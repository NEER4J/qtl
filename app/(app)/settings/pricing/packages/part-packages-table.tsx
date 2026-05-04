"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
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
import { togglePartPackageActive } from "@/lib/actions/pricing";
import type { PartPackageItemRow, PartPackageWithItems } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

import { PartPackageFormDialog } from "./part-package-form-dialog";

// Item #20 — packages grid showing rolled-up cost / list / margin.
//
// Cost = sum(parts.cost + parts.mhsw_fee) × quantity for part rows,
//        plus oil-type rate × litres for oil-typed rows (rate matches the
//        oil grid so package totals reconcile with the grid).
// List = sum(unit_price override OR parts.list_price OR computed oil price)
//        × quantity.
// Margin% = (List - Cost) / List × 100, hidden when List = 0.

function rollUp(items: PartPackageItemRow[]): { cost: number; list: number } {
  let cost = 0;
  let list = 0;
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    if (it.part) {
      cost += (Number(it.part.cost) + Number(it.part.mhsw_fee)) * qty;
      const unit =
        it.unit_price != null ? Number(it.unit_price) : Number(it.part.list_price);
      list += unit * qty;
    } else if (it.oil_type) {
      const lpg = Number(it.oil_type.litres_per_gallon) || 4.546;
      const ratePerLitre =
        it.oil_container === "gallon"
          ? Number(it.oil_type.gallon_cost_per_litre) / lpg
          : Number(it.oil_type.bulk_cost_per_litre);
      const litres = Number(it.litres ?? 0);
      const oilLineCost = ratePerLitre * litres * qty;
      cost += oilLineCost;
      const unit = it.unit_price != null ? Number(it.unit_price) : ratePerLitre * litres;
      list += unit * qty;
    }
  }
  return { cost, list };
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
  const [, startTransition] = useTransition();

  const handleToggle = (p: PartPackageWithItems) => {
    setPendingId(p.id);
    startTransition(async () => {
      const res = await togglePartPackageActive({ id: p.id, active: !p.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Package activated" : "Package deactivated");
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
              <TableHead>Name</TableHead>
              <TableHead>Contents</TableHead>
              <TableHead className="w-20 text-right">Items</TableHead>
              {isOwner && <TableHead className="w-24 text-right">Cost</TableHead>}
              <TableHead className="w-24 text-right">List</TableHead>
              {isOwner && <TableHead className="w-20 text-right">Margin</TableHead>}
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOwner ? 8 : 6} className="text-center text-muted-foreground py-8">
                  No packages yet. Click <strong>New package</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((p) => {
                const { cost, list } = rollUp(p.items);
                const marginPct = list > 0 ? ((list - cost) / list) * 100 : null;
                return (
                  <TableRow key={p.id} className={!p.active ? "opacity-60" : undefined}>
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
                      <Badge variant={p.active ? "default" : "secondary"}>
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                          <Pencil className="size-4" />
                        </Button>
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
    </>
  );
}
