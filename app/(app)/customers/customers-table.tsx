"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toggleCustomerActive } from "@/lib/actions/customers";
import type { Customer, Location } from "@/lib/db/types";

import { CustomerFormDialog } from "./customer-form-dialog";

export function CustomersTable({
  customers,
  locations,
}: {
  customers: Customer[];
  locations: Location[];
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.billing_name.toLowerCase().includes(q) ||
      c.contact_no?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.license_plates.some((p) => p.toLowerCase().includes(q))
    );
  });

  const handleToggle = (customer: Customer) => {
    startTransition(async () => {
      const res = await toggleCustomerActive({ id: customer.id, active: !customer.active });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.active ? "Customer reactivated" : "Customer deactivated");
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, plate, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New customer
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plates</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Home location</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {search ? "No customers match your search." : "No customers yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className={!c.active ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{c.billing_name}</TableCell>
                  <TableCell>
                    {c.license_plates.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.license_plates.map((p) => (
                          <Badge key={p} variant="outline" className="font-mono text-xs">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{c.contact_no ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>
                    {c.home_location_id ? (locationMap[c.home_location_id] ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.active ? "default" : "secondary"}>
                      {c.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggle(c)}
                      >
                        {c.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        locations={locations}
      />
      <CustomerFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        customer={editing ?? undefined}
        locations={locations}
      />
    </>
  );
}
