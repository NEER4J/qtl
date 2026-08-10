"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
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
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { listCustomersPaged, mergeCustomers } from "@/lib/actions/customers";
import type { CustomerListRow } from "@/lib/actions/customers";
import { formatPhone } from "@/lib/utils/phone";

function displayName(c: CustomerListRow): string {
  return c.billing_name ?? c.last_or_company ?? "(no name)";
}

export function MergeCustomersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [primary, setPrimary] = useState<CustomerListRow | null>(null);
  // Keyed map, not a Set of ids — the customers list is server-paginated, so a
  // ticked duplicate may drop out of the current search results and we still
  // need its row to show it pinned.
  const [sources, setSources] = useState<Map<string, CustomerListRow>>(new Map());

  // Server-side search: unlike vendors, the customers table doesn't fit in the
  // browser (it's paginated past 1000+), so each keystroke re-queries it.
  const { results, searching } = useDebouncedSearch<CustomerListRow>({
    open,
    query: search,
    fetcher: (q) => listCustomersPaged({ q, pageSize: 20 }).then((r) => r.rows),
  });

  const close = (next: boolean) => {
    if (!next) {
      setSearch("");
      setPrimary(null);
      setSources(new Map());
    }
    onOpenChange(next);
  };

  // Pinned selections first (whatever the search box says), then the search
  // results that aren't already pinned.
  const visible = useMemo(() => {
    const pinned: CustomerListRow[] = [
      ...(primary ? [primary] : []),
      ...[...sources.values()].filter((c) => c.id !== primary?.id),
    ];
    const pinnedIds = new Set(pinned.map((c) => c.id));
    return [...pinned, ...results.filter((c) => !pinnedIds.has(c.id))];
  }, [primary, sources, results]);

  const makePrimary = (c: CustomerListRow) => {
    setPrimary(c);
    // A customer can't be both the primary and a duplicate.
    setSources((prev) => {
      if (!prev.has(c.id)) return prev;
      const next = new Map(prev);
      next.delete(c.id);
      return next;
    });
  };

  const toggleSource = (c: CustomerListRow) => {
    setSources((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, c);
      return next;
    });
  };

  const canMerge = primary != null && sources.size > 0;

  const onConfirm = () => {
    if (!canMerge || !primary) return;
    startTransition(async () => {
      const res = await mergeCustomers({
        target_id: primary.id,
        source_ids: [...sources.keys()],
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Merged ${res.data.merged} duplicate${res.data.merged === 1 ? "" : "s"} into ${displayName(primary)}`,
      );
      close(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge customers</DialogTitle>
          <DialogDescription>
            Pick the <strong>primary</strong> customer to keep, then tick the{" "}
            <strong>duplicates</strong> to fold into it. Their invoices, vehicles,
            store credit and portal logins all <strong>move onto the primary</strong>{" "}
            — nothing in the history is deleted. Contact details the primary is
            missing are copied over; only the duplicates&apos;{" "}
            <strong>name and email</strong> are dropped. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          {searching ? (
            <Loader2 className="absolute left-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          )}
          <Input
            placeholder="Search by name, plate, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="max-h-[320px] overflow-auto rounded-md border divide-y">
          {visible.length === 0 ? (
            <p className="p-4 text-sm text-center text-muted-foreground">
              {searching ? "Searching…" : "No customers match."}
            </p>
          ) : (
            visible.map((c) => {
              const isPrimary = c.id === primary?.id;
              const isSource = sources.has(c.id);
              const sub = [
                formatPhone(c.phone_cell ?? c.contact_no),
                c.email,
                c.plates.join(" "),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${
                    isPrimary ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{displayName(c)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {sub || "—"}
                      {!c.active && " · inactive"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isPrimary ? "default" : "outline"}
                    onClick={() => makePrimary(c)}
                  >
                    {isPrimary ? "Primary" : "Set primary"}
                  </Button>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={isSource}
                      disabled={isPrimary}
                      onCheckedChange={() => toggleSource(c)}
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
              {sources.size} duplicate{sources.size === 1 ? "" : "s"} will be merged into{" "}
              <strong>{primary ? displayName(primary) : ""}</strong> and then deleted.
            </span>
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => close(false)}
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
