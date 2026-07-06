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
                  <TableHead className="text-right">
                    {g.kind === "coolant_flush" ? "Gallons" : "Litres"}
                  </TableHead>
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
                {g.rows.map((r) => {
                  const unit = g.kind === "coolant_flush" ? "gal" : "L";
                  const hasOil2 = r.oil_type_id_2 != null;
                  return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.name}
                      {r.container && (
                        <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                          · {r.container}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {r.litres != null ? `${r.litres.toFixed(1)}${unit}` : "—"}
                      {r.litres_2 != null && ` + ${r.litres_2.toFixed(1)}${unit}`}
                    </TableCell>
                    {showCost && g.kind === "coolant_flush" && (
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.labour != null ? formatMoney(r.labour) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums font-semibold">
                      {hasOil2 && r.sell_price_2 != null ? (
                        <div className="flex flex-col items-end">
                          <span className={r.default_oil === 1 ? "font-semibold" : "text-muted-foreground font-normal"}>
                            {formatMoney(r.sell_price)}
                            {r.default_oil === 1 && <span className="ml-1 text-[10px] text-muted-foreground">default</span>}
                          </span>
                          <span className={r.default_oil === 2 ? "font-semibold" : "text-muted-foreground font-normal"}>
                            {formatMoney(r.sell_price_2)}
                            {r.default_oil === 2 && <span className="ml-1 text-[10px] text-muted-foreground">default</span>}
                          </span>
                        </div>
                      ) : (
                        formatMoney(r.sell_price)
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[r.oil_type_name, r.oil_type_name_2].filter(Boolean).join(" + ") ||
                        r.notes ||
                        "—"}
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
                  );
                })}
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
