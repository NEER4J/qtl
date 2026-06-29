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
import { togglePromotionActive } from "@/lib/actions/promotions";
import type { Promotion } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

import { PromotionFormDialog } from "./promotion-form-dialog";

export function PromotionsTable({ promotions }: { promotions: Promotion[] }) {
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (p: Promotion) => {
    setPendingId(p.id);
    startTransition(async () => {
      const res = await togglePromotionActive({ id: p.id, active: !p.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Activated" : "Deactivated");
    });
  };

  const fmt = (p: Promotion) =>
    p.discount_type === "percent" ? `${p.discount_value}% off` : `${formatMoney(p.discount_value)} off`;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New promotion
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-260px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No promotions yet. Click <strong>New promotion</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              promotions.map((p) => (
                <TableRow key={p.id} className={!p.active ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="tabular-nums">{fmt(p)}</TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "default" : "secondary"}>
                      {p.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PromotionFormDialog open={creating} onOpenChange={setCreating} mode="create" />
      <PromotionFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        promotion={editing ?? undefined}
      />
    </>
  );
}
