"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
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
import { toggleTransmissionServiceActive } from "@/lib/actions/pricing";
import type { TransmissionService } from "@/lib/actions/pricing";
import type { OilType } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

import { TransServiceFormDialog } from "./trans-service-form-dialog";

type Group = { kind: string; label: string; rows: TransmissionService[] };

export function TransDiffManager({
  groups,
  oilTypes,
  canEdit,
  showCost,
}: {
  groups: Group[];
  oilTypes: OilType[];
  canEdit: boolean;
  showCost: boolean;
}) {
  const [editing, setEditing] = useState<TransmissionService | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (s: TransmissionService) => {
    setPendingId(s.id);
    startTransition(async () => {
      const res = await toggleTransmissionServiceActive({ id: s.id, active: !s.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Activated" : "Deactivated");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <div className="flex justify-end print:hidden">
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New service
          </Button>
        </div>
      )}

      {groups.map((g) => (
        <Card key={g.kind} className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{g.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Litres</TableHead>
                  {showCost && g.kind === "coolant_flush" && (
                    <TableHead className="text-right">Labour</TableHead>
                  )}
                  <TableHead className="text-right">Sell price</TableHead>
                  <TableHead>Oil / Notes</TableHead>
                  <TableHead className="text-right">Type</TableHead>
                  {canEdit && <TableHead className="text-right print:hidden">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {r.litres != null ? `${r.litres.toFixed(1)}L` : "—"}
                    </TableCell>
                    {showCost && g.kind === "coolant_flush" && (
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.labour != null ? formatMoney(r.labour) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatMoney(r.sell_price)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.oil_type_name ?? r.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {g.kind === "coolant_flush" ? (
                        <Badge variant="outline" className="text-xs">Coolant</Badge>
                      ) : r.is_synthetic ? (
                        <Badge className="text-xs">Synthetic</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Regular</Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right print:hidden">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pendingId === r.id}
                            onClick={() => handleToggle(r)}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {canEdit && (
        <>
          <TransServiceFormDialog
            open={creating}
            onOpenChange={setCreating}
            mode="create"
            oilTypes={oilTypes}
          />
          <TransServiceFormDialog
            open={editing !== null}
            onOpenChange={(o) => !o && setEditing(null)}
            mode="edit"
            service={editing ?? undefined}
            oilTypes={oilTypes}
          />
        </>
      )}
    </div>
  );
}
