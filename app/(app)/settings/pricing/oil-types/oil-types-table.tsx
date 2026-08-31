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
import { toggleOilTypeActive } from "@/lib/actions/pricing";
import type { OilGroup, OilType } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

import { OilTypeFormDialog } from "./oil-type-form-dialog";

export function OilTypesTable({
  oilTypes,
  oilGroups = [],
}: {
  oilTypes: OilType[];
  oilGroups?: OilGroup[];
}) {
  const [editing, setEditing] = useState<OilType | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Still the fallback for any grade not in a group — the flag lives on, it is
  // just no longer edited here. See oilLineRate.
  const currentBase = oilTypes.find((o) => o.is_base);

  const groupOf = (oil: OilType) =>
    oil.oil_group_id ? oilGroups.find((g) => g.id === oil.oil_group_id) ?? null : null;

  /**
   * What a bulk sales line of this grade is actually charged per litre, and
   * why. Mirrors oilLineRate's chain exactly: the group's rate, else the base
   * grade's, else the oil's own.
   */
  const chargedRate = (oil: OilType): { rate: number; source: string } => {
    const g = groupOf(oil);
    if (g && g.bulk_price_per_litre != null) {
      return { rate: Number(g.bulk_price_per_litre), source: g.name };
    }
    if (currentBase) {
      return {
        rate: Number(currentBase.bulk_cost_per_litre),
        source: g ? "group has no rate" : "base grade",
      };
    }
    return { rate: Number(oil.bulk_cost_per_litre), source: "own cost" };
  };

  const handleToggle = (oil: OilType) => {
    setPendingId(oil.id);
    startTransition(async () => {
      const res = await toggleOilTypeActive({ id: oil.id, active: !oil.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Oil type activated" : "Oil type deactivated");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New oil type
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-32">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-40">Oil group</TableHead>
              <TableHead className="w-32 text-right">
                Charged $/L
                <span className="block text-[10px] font-normal text-muted-foreground">
                  on a sales line
                </span>
              </TableHead>
              <TableHead className="w-28 text-right">
                Bulk $/L
                <span className="block text-[10px] font-normal text-muted-foreground">
                  our cost
                </span>
              </TableHead>
              <TableHead className="w-28 text-right">$/gal</TableHead>
              <TableHead className="w-20 text-right">L/gal</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {oilTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No oil types yet. Click <strong>New oil type</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              oilTypes.map((oil) => (
                <TableRow key={oil.id} className={!oil.active ? "opacity-60" : undefined}>
                  <TableCell className="font-mono font-medium">{oil.code}</TableCell>
                  <TableCell>{oil.name}</TableCell>
                  <TableCell className="text-xs">
                    {groupOf(oil) ? (
                      <span className="font-medium">{groupOf(oil)!.name}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {oilGroups.length === 0 ? "—" : "no group"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {(() => {
                      const { rate, source } = chargedRate(oil);
                      return (
                        <>
                          <span className="font-medium">{formatMoney(rate)}</span>
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            {source}
                          </span>
                        </>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(oil.bulk_cost_per_litre)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(oil.gallon_cost_per_litre)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Number(oil.litres_per_gallon).toFixed(3)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={oil.active ? "default" : "secondary"}>
                      {oil.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(oil)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === oil.id}
                        onClick={() => handleToggle(oil)}
                      >
                        {oil.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <OilTypeFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        oilGroups={oilGroups}
      />
      <OilTypeFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        oilType={editing ?? undefined}
        oilGroups={oilGroups}
      />
    </>
  );
}
