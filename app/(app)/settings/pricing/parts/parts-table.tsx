"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { togglePartActive } from "@/lib/actions/pricing";
import type { AdminPartRow, PartCategoryOption } from "@/lib/actions/pricing";
import type { ServiceCost } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import { CreatableCombobox } from "@/components/pricing/creatable-combobox";

import { PartFormDialog } from "./part-form-dialog";

const ANY_CATEGORY = "__any__";

function formatMargin(p: Pick<AdminPartRow, "margin_type" | "margin_value">): string {
  return p.margin_type === "percent"
    ? `${p.margin_value.toFixed(2)}%`
    : formatMoney(p.margin_value);
}

export function PartsTable({
  parts,
  serviceCosts,
  categories,
  brands,
  initialFilters,
}: {
  parts: AdminPartRow[];
  serviceCosts: ServiceCost[];
  categories: PartCategoryOption[];
  brands: string[];
  initialFilters: { q: string; category_id: string; brand: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<AdminPartRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initialFilters.q);
  const [categoryId, setCategoryId] = useState(initialFilters.category_id);
  const [brand, setBrand] = useState(initialFilters.brand);

  const onFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const set = (k: string, v: string) => (v ? params.set(k, v) : params.delete(k));
    set("q", q.trim());
    set("category_id", categoryId);
    set("brand", brand.trim());
    router.push(`?${params.toString()}`);
  };

  const onClear = () => {
    setQ("");
    setCategoryId("");
    setBrand("");
    router.push("?");
  };

  const handleToggle = (p: AdminPartRow) => {
    setPendingId(p.id);
    startTransition(async () => {
      const res = await togglePartActive({ id: p.id, active: !p.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Part activated" : "Part deactivated");
    });
  };

  const filtersActive = q || categoryId || brand;

  return (
    <>
      <form onSubmit={onFilter} className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Search part number or description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-[280px]"
        />
        <div className="w-[220px]">
          <Select
            value={categoryId === "" ? ANY_CATEGORY : categoryId}
            onValueChange={(v) => setCategoryId(v === ANY_CATEGORY ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_CATEGORY}>Any category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.unit_of_measure})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <CreatableCombobox
            value={brand}
            onChange={setBrand}
            suggestions={brands}
            placeholder="Any brand"
            searchPlaceholder="Filter by brand…"
            emptyLabel="No brands yet."
            addLabel="Add brand"
            allowClear
          />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {filtersActive && (
          <Button type="button" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        )}
        <div className="ml-auto">
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New part
          </Button>
        </div>
      </form>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-32">Part #</TableHead>
              <TableHead className="w-28">Brand</TableHead>
              <TableHead className="w-40">Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-32">Service</TableHead>
              <TableHead className="w-24 text-right">Cost</TableHead>
              <TableHead className="w-24 text-right">MHSW</TableHead>
              <TableHead className="w-24 text-right">Margin</TableHead>
              <TableHead className="w-24 text-right">List</TableHead>
              <TableHead className="w-20">Tax</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  {filtersActive ? "No parts match your filter." : "No parts yet. Click New part to add one."}
                </TableCell>
              </TableRow>
            ) : (
              parts.map((p) => (
                <TableRow key={p.id} className={!p.active ? "opacity-60" : undefined}>
                  <TableCell className="font-mono text-sm">{p.part_number}</TableCell>
                  <TableCell>{p.brand}</TableCell>
                  <TableCell className="text-sm">
                    {p.category}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({p.unit_of_measure})
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{p.description ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.service_cost_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(p.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(p.mhsw_fee)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatMargin(p)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatMoney(p.list_price)}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_taxable ? "default" : "secondary"}>
                      {p.is_taxable ? "Taxable" : "Exempt"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
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

      <PartFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        serviceCosts={serviceCosts}
        categories={categories}
        brands={brands}
      />
      <PartFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        part={editing ?? undefined}
        serviceCosts={serviceCosts}
        categories={categories}
        brands={brands}
      />
    </>
  );
}
