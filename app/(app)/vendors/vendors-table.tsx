"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, GitMerge, Pencil, Plus, Search } from "lucide-react";
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
import { toggleVendorActive } from "@/lib/actions/vendors";
import type { ExpenseCategory, Location, Vendor } from "@/lib/db/types";

import { VendorFormDialog } from "./vendor-form-dialog";
import { MergeVendorsDialog } from "./merge-vendors-dialog";

export function VendorsTable({
  vendors,
  categories,
  locations = [],
  hiddenColumns,
  canMerge = false,
}: {
  vendors: Vendor[];
  categories: ExpenseCategory[];
  locations?: Location[];
  /** Per-viewer hidden column keys from profiles.hidden_columns["vendors"]. */
  hiddenColumns?: string[];
  /** Owner / co_owner may merge duplicate vendors. */
  canMerge?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [creating, setCreating] = useState(false);
  const [merging, setMerging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hidden = new Set(hiddenColumns ?? []);
  const show = (key: string) => !hidden.has(key);
  // ALWAYS: Name, Status, Actions. HIDEABLE: category, account_no, contact, email.
  const visibleCount =
    3 + [show("category"), show("account_no"), show("contact"), show("email")].filter(Boolean).length;

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const filtered = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.contact_no?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.account_no?.toLowerCase().includes(q)
    );
  });

  const handleToggle = (vendor: Vendor) => {
    startTransition(async () => {
      const res = await toggleVendorActive({ id: vendor.id, active: !vendor.active });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.active ? "Vendor reactivated" : "Vendor deactivated");
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, account…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          {canMerge && (
            <Button variant="outline" onClick={() => setMerging(true)}>
              <GitMerge className="size-4" /> Merge vendors
            </Button>
          )}
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New vendor
          </Button>
        </div>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              {show("category") && <TableHead>Category</TableHead>}
              {show("account_no") && <TableHead>Account #</TableHead>}
              {show("contact") && <TableHead>Phone</TableHead>}
              {show("email") && <TableHead>Email</TableHead>}
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-48 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="text-center text-muted-foreground py-8 px-6">
                  {search ? (
                    <p>No vendors match <strong>&quot;{search}&quot;</strong>. Try a shorter search, or clear the box.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">No vendors yet.</p>
                      <p className="text-sm">
                        Vendors are added automatically when you record an expense with a new supplier name — you don&apos;t usually need to add them manually here.
                      </p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow
                  key={v.id}
                  className={`cursor-pointer ${!v.active ? "opacity-60" : ""}`}
                  onDoubleClick={() => router.push(`/vendors/${v.id}`)}
                >
                  <TableCell className="font-medium">
                    <Link href={`/vendors/${v.id}`} className="hover:underline">
                      {v.name}
                    </Link>
                  </TableCell>
                  {show("category") && (
                    <TableCell>
                      {v.category_id ? (categoryMap[v.category_id] ?? "—") : "—"}
                    </TableCell>
                  )}
                  {show("account_no") && (
                    <TableCell className="font-mono text-sm">{v.account_no ?? "—"}</TableCell>
                  )}
                  {show("contact") && <TableCell>{v.contact_no ?? "—"}</TableCell>}
                  {show("email") && <TableCell>{v.email ?? "—"}</TableCell>}
                  <TableCell>
                    <Badge variant={v.active ? "default" : "secondary"}>
                      {v.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/vendors/${v.id}`}>
                          Details <ChevronRight className="size-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(v)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggle(v)}
                      >
                        {v.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <VendorFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        categories={categories}
        locations={locations}
      />
      <VendorFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        vendor={editing ?? undefined}
        categories={categories}
        locations={locations}
      />
      {canMerge && (
        <MergeVendorsDialog open={merging} onOpenChange={setMerging} vendors={vendors} />
      )}
    </>
  );
}
