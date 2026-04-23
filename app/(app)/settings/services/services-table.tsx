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
import { toggleServiceTypeActive } from "@/lib/actions/services";
import type { ServiceType } from "@/lib/db/types";

import { ServiceFormDialog } from "./service-form-dialog";

export function ServicesTable({ services }: { services: ServiceType[] }) {
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (svc: ServiceType) => {
    startTransition(async () => {
      const res = await toggleServiceTypeActive({ id: svc.id, active: !svc.active });
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Service type activated" : "Service type deactivated");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New service type
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-28">Sort</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No service types yet.
                </TableCell>
              </TableRow>
            ) : (
              services.map((svc) => (
                <TableRow key={svc.id} className={!svc.active ? "opacity-60" : undefined}>
                  <TableCell className="font-mono font-medium">{svc.code}</TableCell>
                  <TableCell>{svc.name}</TableCell>
                  <TableCell>{svc.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={svc.active ? "default" : "secondary"}>
                      {svc.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(svc)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggle(svc)}
                      >
                        {svc.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ServiceFormDialog open={creating} onOpenChange={setCreating} mode="create" />
      <ServiceFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        service={editing ?? undefined}
      />
    </>
  );
}
