"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergeVendors } from "@/lib/actions/vendors";
import { listActiveLocations } from "@/lib/actions/reference";
import type { Location, Vendor } from "@/lib/db/types";

// Radix Select can't hold an empty value — "no location" uses a sentinel.
const NO_LOCATION = "__none__";

export function MergeVendorsDialog({
  open,
  onOpenChange,
  vendors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
}) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [sourceIds, setSourceIds] = useState<Set<string>>(new Set());
  const [locations, setLocations] = useState<Location[]>([]);
  // duplicate vendor_id → location_id (its account # becomes that location's account).
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      listActiveLocations().then(setLocations).catch(() => {});
    } else {
      setSearch("");
      setPrimaryId(null);
      setSourceIds(new Set());
      setLocationMap({});
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.account_no?.toLowerCase().includes(q) ||
        v.contact_no?.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q)
      );
    });
  }, [vendors, search]);

  const primary = vendors.find((v) => v.id === primaryId) ?? null;

  const setPrimary = (id: string) => {
    setPrimaryId(id);
    // A vendor can't be both the primary and a duplicate.
    setSourceIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleSource = (id: string) => {
    setSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canMerge = primaryId != null && sourceIds.size > 0;

  const onConfirm = () => {
    if (!canMerge || !primaryId) return;
    // Only keep location mappings for vendors still ticked as duplicates.
    const location_map: Record<string, string> = {};
    for (const id of sourceIds) {
      const loc = locationMap[id];
      if (loc && loc !== NO_LOCATION) location_map[id] = loc;
    }
    startTransition(async () => {
      const res = await mergeVendors({
        target_id: primaryId,
        source_ids: [...sourceIds],
        location_map: Object.keys(location_map).length ? location_map : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Merged ${res.data.merged} duplicate${res.data.merged === 1 ? "" : "s"} into ${primary?.name ?? "the vendor"}`,
      );
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge vendors</DialogTitle>
          <DialogDescription>
            Pick the <strong>primary</strong> vendor to keep, then tick the{" "}
            <strong>duplicates</strong> to fold into it. Their locations, accounts,
            parts, expenses and invoices all <strong>move onto the primary</strong> (nothing
            is deleted). For a per-location duplicate, choose its <strong>location</strong> so its
            account number becomes the primary&apos;s account for that location (shown on the
            expense form). Only the primary&apos;s name is kept. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="max-h-[320px] overflow-auto rounded-md border divide-y">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-center text-muted-foreground">No vendors match.</p>
          ) : (
            filtered.map((v) => {
              const isPrimary = v.id === primaryId;
              const isSource = sourceIds.has(v.id);
              return (
                <div
                  key={v.id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${
                    isPrimary ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{v.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {v.account_no || v.contact_no || v.email || "—"}
                      {!v.active && " · inactive"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isPrimary ? "default" : "outline"}
                    onClick={() => setPrimary(v.id)}
                  >
                    {isPrimary ? "Primary" : "Set primary"}
                  </Button>
                  {isSource && locations.length > 0 && (
                    <Select
                      value={locationMap[v.id] ?? NO_LOCATION}
                      onValueChange={(val) =>
                        setLocationMap((m) => ({ ...m, [v.id]: val }))
                      }
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Location…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_LOCATION}>No location</SelectItem>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={isSource}
                      disabled={isPrimary}
                      onCheckedChange={() => toggleSource(v.id)}
                    />
                    Merge in
                  </label>
                </div>
              );
            })
          )}
        </div>

        {canMerge && (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              {sourceIds.size} duplicate{sourceIds.size === 1 ? "" : "s"} will be merged into{" "}
              <strong>{primary?.name}</strong> and then deleted.
            </span>
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={!canMerge || isPending}>
            {isPending ? "Merging…" : "Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
