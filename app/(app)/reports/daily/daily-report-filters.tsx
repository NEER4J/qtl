"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useDateCommit } from "@/hooks/use-date-commit";

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

export function DailyReportFilters({
  initial,
  locations,
  locationLocked,
}: {
  /** `from`/`to` are the span the report actually covers (resolved server-side). */
  initial: { from: string; to: string; location_id: string; customer_status: string };
  locations: Location[];
  locationLocked: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setField = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    // `date` is the old one-day link; From/To replace it.
    if (key === "from" || key === "to") next.delete("date");
    startTransition(() => router.push(`/reports/daily?${next.toString()}`));
  };
  const setDateField = useDateCommit(setField);

  // Keyed on the resolved value, so a box the report adjusted (a To picked
  // before any From, a span trimmed to the limit) shows what is really covered.
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">From</label>
        <Input
          key={`from-${initial.from}`}
          type="date"
          className="h-9 w-40"
          defaultValue={initial.from}
          onChange={(e) => setDateField("from", e.target.value)}
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">To</label>
        <Input
          key={`to-${initial.to}`}
          type="date"
          className="h-9 w-40"
          defaultValue={initial.to}
          onChange={(e) => setDateField("to", e.target.value)}
          disabled={isPending}
        />
      </div>
      {!locationLocked && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Location</label>
          <Select
            defaultValue={initial.location_id || ALL}
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
        <label className="text-xs text-muted-foreground">Customer status</label>
        <Select
          defaultValue={initial.customer_status || ALL}
          onValueChange={(v) => setField("customer_status", v)}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="old">Old</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
