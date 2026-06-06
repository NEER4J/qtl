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
import { toggleTechnicianActive } from "@/lib/actions/technicians";
import type { Location, Technician } from "@/lib/db/types";

import { TechnicianFormDialog } from "./technician-form-dialog";

export function TechniciansTable({
  rows,
  locations,
}: {
  rows: Technician[];
  locations: Location[];
}) {
  const [editing, setEditing] = useState<Technician | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));

  const handleToggle = (t: Technician) => {
    setPendingId(t.id);
    startTransition(async () => {
      const res = await toggleTechnicianActive({ id: t.id, active: !t.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Activated" : "Deactivated");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New technician
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-24">Sort</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No technicians yet. Click <strong>New technician</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => (
                <TableRow key={t.id} className={!t.active ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.role ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.location_id ? (locationNameById.get(t.location_id) ?? "—") : "All locations"}
                  </TableCell>
                  <TableCell>{t.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={t.active ? "default" : "secondary"}>
                      {t.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(t)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === t.id}
                        onClick={() => handleToggle(t)}
                      >
                        {t.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TechnicianFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        locations={locations}
      />
      <TechnicianFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        technician={editing ?? undefined}
        locations={locations}
      />
    </>
  );
}
