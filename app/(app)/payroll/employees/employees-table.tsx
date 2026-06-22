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
import { toggleEmployeeActive } from "@/lib/actions/payroll";
import type { EmployeeWithLinks, LinkableProfile } from "@/lib/actions/payroll";
import type { Location } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

import { EmployeeFormDialog } from "./employee-form-dialog";

export function EmployeesTable({
  rows,
  locations,
  profiles,
}: {
  rows: EmployeeWithLinks[];
  locations: Location[];
  profiles: LinkableProfile[];
}) {
  const [editing, setEditing] = useState<EmployeeWithLinks | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (e: EmployeeWithLinks) => {
    setPendingId(e.id);
    startTransition(async () => {
      const res = await toggleEmployeeActive({ id: e.id, active: !e.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Activated" : "Deactivated");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New employee
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-260px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Linked login</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No employees yet. Click <strong>New employee</strong> to add your staff before
                  putting them on payroll.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => (
                <TableRow key={e.id} className={!e.active ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">
                    {e.full_name}
                    {e.code ? (
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{e.code}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">{e.payroll_type}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(e.default_hourly_rate) > 0 ? formatMoney(e.default_hourly_rate) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.location_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.linked_user_name ?? <span className="text-muted-foreground/60">Not linked</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.active ? "default" : "secondary"}>
                      {e.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(e)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === e.id}
                        onClick={() => handleToggle(e)}
                      >
                        {e.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EmployeeFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        locations={locations}
        profiles={profiles}
      />
      <EmployeeFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        employee={editing ?? undefined}
        locations={locations}
        profiles={profiles}
      />
    </>
  );
}
