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
import { toggleLocationActive } from "@/lib/actions/locations";
import type { Location } from "@/lib/db/types";

import { LocationFormDialog } from "./location-form-dialog";

export function LocationsTable({ locations }: { locations: Location[] }) {
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (loc: Location) => {
    startTransition(async () => {
      const result = await toggleLocationActive({
        id: loc.id,
        active: !loc.active,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.active ? "Location reactivated" : "Location deactivated");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New location
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8 px-6">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">No locations yet.</p>
                    <p className="text-sm">
                      Add your first shop using the <strong>New location</strong> button above. Locations are the foundation — you&apos;ll need at least one before you can invite staff, record sales, or run payroll.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              locations.map((loc) => (
                <TableRow key={loc.id} className={!loc.active ? "opacity-60" : undefined}>
                  <TableCell className="font-mono">{loc.code}</TableCell>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{loc.address ?? "—"}</TableCell>
                  <TableCell>{loc.phone ?? "—"}</TableCell>
                  <TableCell>{loc.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={loc.active ? "default" : "secondary"}>
                      {loc.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(loc)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggle(loc)}
                      >
                        {loc.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LocationFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
      />
      <LocationFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        location={editing ?? undefined}
      />
    </>
  );
}
