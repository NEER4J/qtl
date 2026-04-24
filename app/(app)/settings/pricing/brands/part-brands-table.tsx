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
import { togglePartBrandActive } from "@/lib/actions/pricing";
import type { PartBrand } from "@/lib/db/types";

import { PartBrandFormDialog } from "./part-brand-form-dialog";

export function PartBrandsTable({ brands }: { brands: PartBrand[] }) {
  const [editing, setEditing] = useState<PartBrand | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (b: PartBrand) => {
    setPendingId(b.id);
    startTransition(async () => {
      const res = await togglePartBrandActive({ id: b.id, active: !b.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Brand activated" : "Brand deactivated");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New brand
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-24">Sort</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No brands yet. Click <strong>New brand</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              brands.map((b) => (
                <TableRow key={b.id} className={!b.active ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={b.active ? "default" : "secondary"}>
                      {b.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(b)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === b.id}
                        onClick={() => handleToggle(b)}
                      >
                        {b.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PartBrandFormDialog open={creating} onOpenChange={setCreating} mode="create" />
      <PartBrandFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        brand={editing ?? undefined}
      />
    </>
  );
}
