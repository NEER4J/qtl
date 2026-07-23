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

/**
 * Vendors created per-shop are conventionally named "<Name> (<location code>)"
 * (e.g. "Enbride ( AYR )" — see the screenshot that prompted this: a duplicate
 * whose account # only lived in its own top-level field, not yet in
 * vendor_location_accounts). Guessing the location from that suffix means the
 * merge dialog's per-duplicate location picker starts correct instead of
 * relying on the admin to notice and pick it — the ONE thing that must not be
 * missed is the account #, and merge_vendors() only carries it over when a
 * location IS supplied (see 0109). Returns null when the name doesn't match
 * any active location's code, leaving the picker on "No location" as before.
 */
function guessLocationFromName(name: string, locations: Location[]): string | null {
  const match = name.match(/\(\s*([A-Za-z0-9_-]+)\s*\)\s*$/);
  if (!match) return null;
  const code = match[1]!.toLowerCase();
  return locations.find((l) => l.code.toLowerCase() === code)?.id ?? null;
}

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
  // Which entries in locationMap came from the auto-guess rather than a
  // manual pick — shown as a hint so the admin can double-check it, since a
  // wrong guess here means an account # lands on the wrong location.
  const [autoGuessedIds, setAutoGuessedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      listActiveLocations().then(setLocations).catch(() => {});
    } else {
      setSearch("");
      setPrimaryId(null);
      setSourceIds(new Set());
      setLocationMap({});
      setAutoGuessedIds(new Set());
    }
  }, [open]);

  // Runs whenever a duplicate gets ticked OR `locations` finishes loading
  // (covers a duplicate ticked before the location list arrived) — fills in
  // any source that doesn't already have a location mapped, without
  // overwriting a manual pick (including a deliberate "No location").
  useEffect(() => {
    if (locations.length === 0) return;
    setLocationMap((prev) => {
      let changed = false;
      const next = { ...prev };
      const newlyGuessed = new Set<string>();
      for (const id of sourceIds) {
        if (next[id]) continue;
        const v = vendors.find((x) => x.id === id);
        const guess = v ? guessLocationFromName(v.name, locations) : null;
        if (guess) {
          next[id] = guess;
          newlyGuessed.add(id);
          changed = true;
        }
      }
      if (changed) {
        setAutoGuessedIds((prevGuessed) => new Set([...prevGuessed, ...newlyGuessed]));
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vendors is stable per open; re-run only when locations arrive or the ticked set changes.
  }, [locations, sourceIds]);

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
            is deleted). For a per-location duplicate, its <strong>location</strong> is guessed
            from a name like &quot;Vendor (AYR)&quot; — check the guess — so its account number
            becomes the primary&apos;s account for that location (shown on the expense form).
            Only the primary&apos;s name is kept. This can&apos;t be undone.
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
                    <div className="flex flex-col items-start gap-0.5">
                      <Select
                        value={locationMap[v.id] ?? NO_LOCATION}
                        onValueChange={(val) => {
                          setLocationMap((m) => ({ ...m, [v.id]: val }));
                          // A manual change (including picking "No location")
                          // overrides the guess — stop flagging it as guessed.
                          setAutoGuessedIds((prev) => {
                            if (!prev.has(v.id)) return prev;
                            const next = new Set(prev);
                            next.delete(v.id);
                            return next;
                          });
                        }}
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
                      {autoGuessedIds.has(v.id) && (
                        <span className="text-[10px] text-muted-foreground">
                          guessed from name — check it
                        </span>
                      )}
                    </div>
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
