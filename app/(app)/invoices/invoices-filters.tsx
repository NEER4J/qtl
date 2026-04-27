"use client";

import { useCallback, useTransition } from "react";
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
import type { Location } from "@/lib/db/types";

const ALL = "__all__";

export function InvoicesFilters({
  initial,
  locations,
}: {
  initial: Record<string, string | undefined>;
  locations?: Location[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (next: URLSearchParams) => {
      next.delete("page");
      startTransition(() => router.push(`/invoices?${next.toString()}`));
    },
    [router],
  );

  const setField = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    push(next);
  };

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (new FormData(form).get("q") as string) ?? "";
    setField("q", q);
  };

  const clearAll = () => {
    startTransition(() => router.push("/invoices"));
  };

  const hasFilters = Array.from(params.keys()).some((k) => k !== "page");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
      <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={initial.q ?? ""}
            placeholder="Invoice, customer, plate…"
            className="h-9 w-64 pl-8"
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
