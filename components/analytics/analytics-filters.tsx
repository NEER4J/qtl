"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Location } from "@/lib/db/types";

const ALL = "__all__";

interface Extra {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export function AnalyticsFilters({
  locations,
  extras,
  canFilterLocation,
  exportHref,
}: {
  locations: Location[];
  extras?: Extra[];
  canFilterLocation: boolean;
  exportHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setField = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params);
      if (!value || value === ALL) next.delete(key);
      else next.set(key, value);
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

  const clearAll = () => startTransition(() => router.push(pathname));
  const hasFilters = Array.from(params.keys()).length > 0;

  const exportWithParams = exportHref
    ? `${exportHref}${params.toString() ? `?${params.toString()}` : ""}`
    : null;

  return (
    <div className="flex flex-wrap items-end gap-3 border rounded-lg p-3 bg-muted/30">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          defaultValue={params.get("from") ?? ""}
          onBlur={(e) => setField("from", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          defaultValue={params.get("to") ?? ""}
          onBlur={(e) => setField("to", e.target.value)}
        />
      </div>

      {canFilterLocation && locations.length > 1 && (
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <Select
            value={params.get("location_id") ?? ALL}
            onValueChange={(v) => setField("location_id", v)}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {extras?.map((ex) => (
        <div key={ex.key} className="space-y-1">
          <Label className="text-xs">{ex.label}</Label>
          <Select
            value={params.get(ex.key) ?? ALL}
            onValueChange={(v) => setField(ex.key, v)}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {ex.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      <div className="flex gap-2 ml-auto">
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={isPending}>
            <X className="size-4" /> Clear
          </Button>
        )}
        {exportWithParams && (
          <Button asChild type="button" variant="outline" size="sm">
            <a href={exportWithParams} download>
              <Download className="size-4" /> CSV
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
