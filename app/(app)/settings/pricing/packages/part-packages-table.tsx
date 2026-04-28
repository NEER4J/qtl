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
import type { PartPackageWithItems } from "@/lib/db/types";

import { PartPackageFormDialog } from "./part-package-form-dialog";

function summarise(pkg: PartPackageWithItems): string {
  if (pkg.items.length === 0) return "(no parts)";
  const max = 3;
  const head = pkg.items
    .slice(0, max)
    .map((it) => `${Number(it.quantity)}× ${it.part.brand} ${it.part.part_number}`)
    .join(", ");
  return pkg.items.length > max ? `${head}, +${pkg.items.length - max} more` : head;
}

export function PartPackagesTable({ packages }: { packages: PartPackageWithItems[] }) {
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contents</TableHead>
              <TableHead className="w-20 text-right">Items</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No packages yet. Click <strong>New package</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((p) => (
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
              ))
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
