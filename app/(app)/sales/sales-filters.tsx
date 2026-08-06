"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLiveSearchParam } from "@/hooks/use-live-search-param";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Location, ServiceType } from "@/lib/db/types";

const ALL = "__all__";

export function SalesFilters({
  initial,
  locations,
  serviceTypes,
}: {
  initial: Record<string, string | undefined>;
  locations?: Location[];
  serviceTypes: ServiceType[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { value: q, setValue: setQ, searching } = useLiveSearchParam();

  const push = useCallback(
    (next: URLSearchParams) => {
      // Reset pagination whenever a filter changes
      next.delete("page");
      startTransition(() => router.push(`/sales?${next.toString()}`));
    },
    [router],
  );

  const setField = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    push(next);
  };

  const clearAll = () => {
    startTransition(() => router.push("/sales"));
  };

  const hasFilters = Array.from(params.keys()).some((k) => k !== "page");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
      {/* Live search — updates as you type (debounced), no submit needed. */}
      <div className="relative">
        {searching || isPending ? (
          <Loader2 className="absolute left-2 top-2.5 size-4 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Invoice, customer, plate…"
          aria-label="Search"
          className="h-9 w-64 pl-8"
        />
      </div>

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
        <label className="text-xs text-muted-foreground">Service</label>
        <Select
          defaultValue={initial.service_type_id ?? ALL}
          onValueChange={(v) => setField("service_type_id", v)}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All services</SelectItem>
            {serviceTypes.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
