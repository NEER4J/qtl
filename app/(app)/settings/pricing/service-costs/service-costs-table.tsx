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
import { toggleServiceCostActive } from "@/lib/actions/pricing";
import type { ServiceCost } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

import { ServiceCostFormDialog } from "./service-cost-form-dialog";

export function ServiceCostsTable({ serviceCosts }: { serviceCosts: ServiceCost[] }) {
  const [editing, setEditing] = useState<ServiceCost | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (sc: ServiceCost) => {
    setPendingId(sc.id);
    startTransition(async () => {
      const res = await toggleServiceCostActive({ id: sc.id, active: !sc.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Service cost activated" : "Service cost deactivated");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New service cost
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-40">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-32 text-right">Cost</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {serviceCosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No service costs yet.
                </TableCell>
              </TableRow>
            ) : (
              serviceCosts.map((sc) => (
                <TableRow key={sc.id} className={!sc.active ? "opacity-60" : undefined}>
                  <TableCell className="font-mono font-medium">{sc.code}</TableCell>
                  <TableCell>{sc.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sc.cost)}</TableCell>
                  <TableCell>
                    <Badge variant={sc.active ? "default" : "secondary"}>
                      {sc.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(sc)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === sc.id}
                        onClick={() => handleToggle(sc)}
                      >
                        {sc.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ServiceCostFormDialog open={creating} onOpenChange={setCreating} mode="create" />
      <ServiceCostFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        serviceCost={editing ?? undefined}
      />
    </>
  );
}
