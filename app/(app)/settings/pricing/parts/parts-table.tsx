"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLiveSearchParam } from "@/hooks/use-live-search-param";
import { Download, Loader2, Pencil, Plus } from "lucide-react";
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
import { PrintButton } from "@/components/pricing/print-button";
import { togglePartActive } from "@/lib/actions/pricing";
import { getPartStockSummary } from "@/lib/actions/inventory";
import type { AdminPartRow, PartCategoryOption } from "@/lib/actions/pricing";
import type { ServiceCost } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import { CreatableCombobox } from "@/components/pricing/creatable-combobox";

import { PartFormDialog } from "./part-form-dialog";

const ANY_CATEGORY = "__any__";

/** Which sell tiers this part holds at a fixed price (parts.*_price). A fixed
 *  price wins over the cost / margin / service-charge formula, so these are the
 *  tiers an edit to Cost or Margin will NOT move. */
function fixedTiers(
  p: Pick<AdminPartRow, "without_service_price" | "with_service_price" | "over_counter_price">,
): string[] {
  const out: string[] = [];
  if (p.over_counter_price != null) out.push("Over the counter");
  if (p.with_service_price != null) out.push("With service");
  if (p.without_service_price != null) out.push("Without service");
  return out;
}

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
  globalCounterPremium,
  globalCustomerSuppliesLabour,
  initialFilters,
}: {
  parts: AdminPartRow[];
  serviceCosts: ServiceCost[];
  categories: PartCategoryOption[];
  brands: string[];
  globalCounterPremium: number;
  globalCustomerSuppliesLabour: number;
  // Only the status tab is still passed in: q / category / brand are read
  // straight off the URL now that the filter bar drives it live, and keeping
  // stale copies here invites someone to wire the inputs back to them.
  initialFilters: {
    status: "active" | "inactive";
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<AdminPartRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isFiltering, startFilterTransition] = useTransition();
  // Search is live and URL-driven; the selects apply the moment they change.
  // Nothing here waits for a submit any more.
  const { value: q, setValue: setQ, searching } = useLiveSearchParam();
  const categoryId = searchParams.get("category_id") ?? "";
  const brand = searchParams.get("brand") ?? "";

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startFilterTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  };

  const onClear = () => {
    setQ("");
    startFilterTransition(() => router.push("?"));
  };

  const setStatusFilter = (s: "active" | "inactive") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", s);
    startFilterTransition(() => router.push(`?${params.toString()}`));
  };

  const handleToggle = (p: AdminPartRow) => {
    startTransition(async () => {
      setPendingId(p.id);
      // Deactivating a part that still has stock on hand → warn first.
      if (p.active) {
        try {
          const stock = await getPartStockSummary(p.id);
          if (stock.total > 0) {
            const ok = window.confirm(
              `${p.brand} ${p.part_number} has ${stock.total} unit(s) in inventory across ${stock.locations} location(s).\n\nDeactivate anyway?`,
            );
            if (!ok) {
              setPendingId(null);
              return;
            }
          }
        } catch {
          // If the stock check fails, fall through and let the toggle proceed.
        }
      }
      const res = await togglePartActive({ id: p.id, active: !p.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Part activated" : "Part deactivated");
    });
  };

  const filtersActive = q || categoryId || brand;

  return (
    <>
      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <div className="relative w-[280px]">
          <Input
            placeholder="Search part number or description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pr-8"
          />
          {(isFiltering || searching) && (
            <Loader2 className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="w-[220px]">
          <Select
            value={categoryId === "" ? ANY_CATEGORY : categoryId}
            onValueChange={(v) => setFilter("category_id", v === ANY_CATEGORY ? "" : v)}
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
            onChange={(v) => setFilter("brand", v)}
            suggestions={brands}
            placeholder="Any brand"
            searchPlaceholder="Filter by brand…"
            emptyLabel="No brands yet."
            addLabel="Add brand"
            allowClear
          />
        </div>
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
      </div>

      <div className="flex items-center gap-1 print:hidden">
        {(["active", "inactive"] as const).map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={initialFilters.status === s ? "default" : "outline"}
            disabled={isFiltering}
            onClick={() => setStatusFilter(s)}
          >
            {s === "active" ? "Active" : "Inactive"}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            {/* Exports what's on screen — same q/category/brand/status filters. */}
            <a href={`/api/export/parts?${searchParams.toString()}`} download>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
          <PrintButton />
        </div>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible print:border-0">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-32">Part #</TableHead>
              <TableHead className="w-28">Brand</TableHead>
              <TableHead className="w-40">Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-32">Service</TableHead>
              <TableHead className="w-24 text-right">Cost</TableHead>
              <TableHead className="w-24 text-right">Sell MHSW</TableHead>
              <TableHead className="w-24 text-right">Buy MHSW</TableHead>
              <TableHead className="w-24 text-right">Margin</TableHead>
              <TableHead className="w-24 text-right">List</TableHead>
              <TableHead className="w-20">Tax</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-40 text-right print:hidden">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  {filtersActive ? "No parts match your filter." : "No parts yet. Click New part to add one."}
                </TableCell>
              </TableRow>
            ) : (
              parts.map((p) => (
                <TableRow
                  key={p.id}
                  // content-visibility lets the browser skip layout/paint for
                  // off-screen rows, so a long catalogue (1000s of parts)
                  // scrolls smoothly instead of lagging.
                  className={`[content-visibility:auto] [contain-intrinsic-size:auto_41px] ${!p.active ? "opacity-60" : ""}`}
                >
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
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(p.mhsw_buy)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatMargin(p)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatMoney(p.list_price)}
                    {/* List price follows Cost + Sell MHSW + Margin, but a tier
                        held at a fixed price ignores all three — so editing cost
                        here moves this number and nothing the customer is
                        charged. Say so where the editing happens. */}
                    {fixedTiers(p).length > 0 && (
                      <span
                        className="mt-0.5 block text-[10px] font-normal text-amber-600 dark:text-amber-500"
                        title={`${fixedTiers(p).join(", ")} ${
                          fixedTiers(p).length === 1 ? "is" : "are"
                        } held at a fixed price on this part and will not follow Cost or Margin. Edit the part to see or clear it.`}
                      >
                        {fixedTiers(p).length === 3 ? "sell price fixed" : "some prices fixed"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_taxable ? "default" : "secondary"}>
                      {p.is_taxable ? "Taxable" : "Exempt"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right print:hidden">
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
        globalCounterPremium={globalCounterPremium}
        globalCustomerSuppliesLabour={globalCustomerSuppliesLabour}
      />
      <PartFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        part={editing ?? undefined}
        serviceCosts={serviceCosts}
        categories={categories}
        brands={brands}
        globalCounterPremium={globalCounterPremium}
        globalCustomerSuppliesLabour={globalCustomerSuppliesLabour}
      />
    </>
  );
}
