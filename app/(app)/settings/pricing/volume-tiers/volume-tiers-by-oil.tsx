"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteVolumeTier } from "@/lib/actions/pricing";
import type { OilType, VolumeTier } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

import { VolumeTierFormDialog } from "./volume-tier-form-dialog";

export function VolumeTiersByOil({
  oilType,
  tiers,
}: {
  oilType: OilType;
  tiers: VolumeTier[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VolumeTier | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sorted = [...tiers].sort((a, b) => Number(a.min_litres) - Number(b.min_litres));

  const onDelete = (tier: VolumeTier) => {
    setPendingId(tier.id);
    startTransition(async () => {
      const res = await deleteVolumeTier({ id: tier.id });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success("Tier removed");
    });
  };

  return (
    <>
      <Card className={!oilType.active ? "opacity-70" : undefined}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="font-mono">{oilType.code}</span>
            <span className="text-muted-foreground font-normal">— {oilType.name}</span>
            {oilType.is_base && <Badge variant="default">Base</Badge>}
            {!oilType.active && <Badge variant="secondary">Inactive</Badge>}
          </CardTitle>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add tier
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              No tiers. Click <strong>Add tier</strong> to create one (start with min L = 0 for a default).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40 text-right">Min litres (≥)</TableHead>
                  <TableHead className="w-40 text-right">Premium</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-right tabular-nums">
                      {Number(t.min_litres).toFixed(2)} L
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatMoney(t.premium)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(t)}
                          disabled={pendingId === t.id}
                          title="Delete tier"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <VolumeTierFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        oilTypeId={oilType.id}
      />
      <VolumeTierFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        oilTypeId={oilType.id}
        tier={editing ?? undefined}
      />
    </>
  );
}
