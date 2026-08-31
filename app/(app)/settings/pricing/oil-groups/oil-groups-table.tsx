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
import { toggleOilGroupActive } from "@/lib/actions/pricing";
import type { OilGroup, OilType } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import { excelOilLabel } from "@/lib/utils/oil-labels";

import { OilGroupFormDialog } from "./oil-group-form-dialog";

export function OilGroupsTable({
  groups,
  oilTypes,
}: {
  groups: OilGroup[];
  oilTypes: OilType[];
}) {
  const [editing, setEditing] = useState<OilGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (g: OilGroup) => {
    setPendingId(g.id);
    startTransition(async () => {
      const res = await toggleOilGroupActive({ id: g.id, active: !g.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Oil group activated" : "Oil group deactivated");
    });
  };

  const membersOf = (groupId: string) =>
    oilTypes.filter((o) => o.oil_group_id === groupId);
  const ungrouped = oilTypes.filter((o) => !o.oil_group_id);

  // "Not set" is a fallback, not a price — say so rather than showing $0.00.
  const rate = (n: number | null) =>
    n == null ? <span className="text-muted-foreground text-xs">not set</span> : formatMoney(n);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New oil group
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead className="w-32 text-right">Bulk $/L</TableHead>
              <TableHead className="w-40 text-right">Gallon $/container</TableHead>
              <TableHead>Grades priced by it</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No oil groups yet. Every grade is charged at the single base grade&apos;s rate
                  until you add one.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => {
                const members = membersOf(g.id);
                return (
                  <TableRow key={g.id} className={g.active ? undefined : "opacity-60"}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rate(g.bulk_price_per_litre)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rate(g.gallon_price_per_container)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {members.length === 0
                        ? "— no grades assigned"
                        : members.map((o) => excelOilLabel(o.code, o.name)).join(", ")}
                    </TableCell>
                    <TableCell>
                      {g.active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(g)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === g.id}
                        onClick={() => handleToggle(g)}
                      >
                        {g.active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {ungrouped.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <strong>{ungrouped.length}</strong> grade{ungrouped.length === 1 ? "" : "s"} in no
          group — still charged at the single base grade&apos;s rate:{" "}
          {ungrouped.map((o) => excelOilLabel(o.code, o.name)).join(", ")}. Assign one on the{" "}
          <span className="font-medium">Oil types</span> page.
        </p>
      )}

      <OilGroupFormDialog open={creating} onOpenChange={setCreating} mode="create" />
      <OilGroupFormDialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="edit"
        group={editing ?? undefined}
      />
    </>
  );
}
