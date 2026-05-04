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
import type { OilType } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

import { OilTypeFormDialog } from "./oil-type-form-dialog";

export function OilTypesTable({ oilTypes }: { oilTypes: OilType[] }) {
  const [editing, setEditing] = useState<OilType | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
              <TableHead className="w-20">Base</TableHead>
              <TableHead className="w-28 text-right">Bulk $/L</TableHead>
              <TableHead className="w-28 text-right">$/gal</TableHead>
              <TableHead className="w-20 text-right">L/gal</TableHead>
              <TableHead className="w-20">Sort</TableHead>
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
                  <TableCell>
                    {oil.is_base ? <Badge variant="default">Base</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(oil.bulk_cost_per_litre)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(oil.gallon_cost_per_litre)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Number(oil.litres_per_gallon).toFixed(3)}
                  </TableCell>
                  <TableCell>{oil.sort_order}</TableCell>
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

      <OilTypeFormDialog open={creating} onOpenChange={setCreating} mode="create" />
      <OilTypeFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        oilType={editing ?? undefined}
      />
    </>
  );
}
