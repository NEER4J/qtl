"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  initial: { date: string; location_id: string; customer_status: string };
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
    startTransition(() => router.push(`/reports/daily?${next.toString()}`));
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Date</label>
        <Input
          type="date"
          className="h-9 w-40"
          defaultValue={initial.date}
          onChange={(e) => setField("date", e.target.value)}
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
