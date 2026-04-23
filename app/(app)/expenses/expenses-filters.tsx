"use client";

import { useCallback, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ExpenseCategory,
  ExpenseSubcategory,
  Location,
} from "@/lib/db/types";

const ALL = "__all__";

export function ExpensesFilters({
  initial,
  locations,
  categories,
  subcategories,
}: {
  initial: Record<string, string | undefined>;
  locations?: Location[];
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (next: URLSearchParams) => {
      next.delete("page");
      startTransition(() => router.push(`/expenses?${next.toString()}`));
    },
    [router],
  );

  const setField = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    if (key === "category_id") next.delete("subcategory_id");
    push(next);
  };

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = (new FormData(e.currentTarget).get("q") as string) ?? "";
    setField("q", q);
  };

  const clearAll = () => startTransition(() => router.push("/expenses"));
  const hasFilters = Array.from(params.keys()).some((k) => k !== "page");

  const subcategoryOptions = useMemo(() => {
    const catId = params.get("category_id") ?? initial.category_id ?? "";
    if (!catId) return [];
    return subcategories.filter((s) => s.category_id === catId);
  }, [params, initial.category_id, subcategories]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
      <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={initial.q ?? ""}
            placeholder="Vendor, invoice…"
            className="h-9 w-56 pl-8"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          Search
        </Button>
      </form>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">From</label>
        <Input
          type="date"
          className="h-9 w-36"
          defaultValue={initial.from ?? ""}
          onChange={(e) => setField("from", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">To</label>
        <Input
          type="date"
          className="h-9 w-36"
          defaultValue={initial.to ?? ""}
          onChange={(e) => setField("to", e.target.value)}
        />
      </div>

      {locations && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Location</label>
          <Select
            defaultValue={initial.location_id ?? ALL}
            onValueChange={(v) => setField("location_id", v)}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Category</label>
        <Select
          defaultValue={initial.category_id ?? ALL}
          onValueChange={(v) => setField("category_id", v)}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {subcategoryOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Sub</label>
          <Select
            defaultValue={initial.subcategory_id ?? ALL}
            onValueChange={(v) => setField("subcategory_id", v)}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {subcategoryOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <Select
          defaultValue={initial.payment_status ?? ALL}
          onValueChange={(v) => setField("payment_status", v)}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="outstanding">Outstanding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="size-4" /> Clear
        </Button>
      )}
    </div>
  );
}
