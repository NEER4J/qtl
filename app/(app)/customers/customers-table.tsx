"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Search } from "lucide-react";
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
import { ListPagination } from "@/components/list-pagination";
import { useLiveSearchParam } from "@/hooks/use-live-search-param";
import { toggleCustomerActive } from "@/lib/actions/customers";
import type { CustomerListRow } from "@/lib/actions/customers";
import type { Customer } from "@/lib/db/types";
import { formatPhone } from "@/lib/utils/phone";

import { CustomerFormDialog } from "./customer-form-dialog";

function customerDisplayName(c: CustomerListRow): string {
  return c.billing_name ?? c.last_or_company ?? "(no name)";
}

export function CustomersTable({
  rows,
  total,
  page,
  pageSize,
  hiddenColumns,
}: {
  rows: CustomerListRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Per-viewer hidden column keys from profiles.hidden_columns["customers"]. */
  hiddenColumns?: string[];
}) {
  const router = useRouter();
  // Search runs on the SERVER now. The list is paginated, so filtering the
  // rows in the browser would only ever search the page you happen to be on —
  // and would silently miss everyone past customer 1000.
  const { value: search, setValue: setSearch, searching } = useLiveSearchParam();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hidden = new Set(hiddenColumns ?? []);
  const show = (key: string) => !hidden.has(key);
  // ALWAYS: Name, Plates, Actions. HIDEABLE: phone, email.
  const visibleCount = 3 + [show("phone"), show("email")].filter(Boolean).length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));


  const handleToggle = (customer: CustomerListRow) => {
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
          {searching ? (
            <Loader2 className="absolute left-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          )}
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

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plates</TableHead>
              {show("phone") && <TableHead>Phone</TableHead>}
              {show("email") && <TableHead>Email</TableHead>}
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="text-center text-muted-foreground py-8 px-6">
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
              rows.map((c) => (
                <TableRow
                  key={c.id}
                  className={`cursor-pointer ${!c.active ? "opacity-60" : ""}`}
                  onDoubleClick={() => router.push(`/customers/${c.id}`)}
                >
                  <TableCell className="font-medium">{customerDisplayName(c)}</TableCell>
                  <TableCell>
                    {c.plates.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.plates.map((p) => (
                          <Badge key={p} variant="outline" className="font-mono text-xs">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {show("phone") && (
                    <TableCell>{formatPhone(c.phone_cell ?? c.contact_no) || "—"}</TableCell>
                  )}
                  {show("email") && <TableCell>{c.email ?? "—"}</TableCell>}
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

      {pageCount > 1 && (
        <ListPagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
        />
      )}

      <CustomerFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
      />
      <CustomerFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        customer={editing ?? undefined}
      />
    </>
  );
}
