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
import { digitsOnly, formatPhone } from "@/lib/utils/phone";

import { CustomerFormDialog } from "./customer-form-dialog";

function customerDisplayName(c: Customer): string {
  return (
    c.billing_name ??
    [c.first_name, c.last_or_company].filter(Boolean).join(" ") ??
    "(no name)"
  );
}

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
    const phoneDigits = digitsOnly(search);
    const name = customerDisplayName(c).toLowerCase();
    return (
      name.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.license_plates.some((p) => p.toLowerCase().includes(q)) ||
      (phoneDigits.length >= 3 && (c.phone_search ?? "").includes(phoneDigits))
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8 px-6">
                  {search ? (
                    <p>No customers match <strong>&quot;{search}&quot;</strong>. Try a shorter search, or clear the box.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">No customers yet.</p>
                      <p className="text-sm">
                        Customers are added automatically the first time you record a sales job with a new billing name — you don&apos;t usually need to add them manually here.
                      </p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className={!c.active ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{customerDisplayName(c)}</TableCell>
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
                  <TableCell>{formatPhone(c.phone_cell ?? c.contact_no) || "—"}</TableCell>
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
