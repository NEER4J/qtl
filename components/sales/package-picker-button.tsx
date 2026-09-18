"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listPackagesForPicker } from "@/lib/actions/pricing";
import type { PartPackageWithItems } from "@/lib/db/types";
import { oilLabel } from "@/lib/utils/oil-labels";

// The whole active package list is loaded ONCE and filtered in the browser, so
// typing never waits on a server round trip (the database is in Seoul). It is
// kept at module level so it survives closing the picker and client-side
// navigation between sales; after REFRESH_AFTER_MS the next open shows the
// cached list straight away and refreshes it in the background.
const REFRESH_AFTER_MS = 5 * 60_000;
// Rows rendered at once — keeps every keystroke cheap with a large catalogue.
const MAX_VISIBLE = 100;

let cached: { at: number; data: PartPackageWithItems[] } | null = null;
let inflight: Promise<PartPackageWithItems[]> | null = null;

function loadPackages(): Promise<PartPackageWithItems[]> {
  if (!inflight) {
    inflight = listPackagesForPicker()
      .then((data) => {
        cached = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Warm the cache ahead of the click (hover / focus). Never throws. */
function prefetchPackages() {
  if (cached && Date.now() - cached.at < REFRESH_AFTER_MS) return;
  loadPackages().catch(() => {});
}

function itemsSummary(pkg: PartPackageWithItems): string {
  if (pkg.items.length === 0) return "(empty package)";
  return pkg.items
    .map((it) => {
      const qty = Number(it.quantity);
      if (it.part) return `${qty}× ${it.part.brand} ${it.part.part_number}`;
      if (it.oil_type) return `${qty}× ${oilLabel(it.oil_type)}`;
      if (it.transmission_service) return `${qty}× ${it.transmission_service.name}`;
      return `${qty}× —`;
    })
    .join(", ");
}

export function PackagePickerButton({
  onSelect,
}: {
  onSelect: (pkg: PartPackageWithItems) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [packages, setPackages] = useState<PartPackageWithItems[] | null>(
    () => cached?.data ?? null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (cached) setPackages(cached.data);
    if (cached && Date.now() - cached.at < REFRESH_AFTER_MS) return;
    let live = true;
    setFailed(false);
    loadPackages().then(
      (data) => live && setPackages(data),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [open]);

  // Lower-cased search text and the item line are built once per load, not on
  // every keystroke.
  const indexed = useMemo(
    () =>
      (packages ?? []).map((pkg) => ({
        pkg,
        haystack: `${pkg.name} ${pkg.description ?? ""}`.toLowerCase(),
        summary: itemsSummary(pkg),
      })),
    [packages],
  );

  // Every word must appear somewhere in the name or description, in any order,
  // so "c13 cat" finds "Cat C13/C15 With Cat Filter".
  const matches = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hits = words.length
      ? indexed.filter((row) => words.every((w) => row.haystack.includes(w)))
      : indexed;
    return hits.slice(0, MAX_VISIBLE);
  }, [indexed, q]);

  const loading = packages === null && !failed;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          onPointerEnter={prefetchPackages}
          onFocus={prefetchPackages}
        >
          <Boxes className="size-4" /> Add package
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[420px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search package name…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>
              {loading
                ? "Loading packages…"
                : failed && packages === null
                  ? "Couldn't load packages. Close and try again."
                  : "No matching packages."}
            </CommandEmpty>
            <CommandGroup>
              {matches.map(({ pkg, summary }) => (
                <CommandItem
                  key={pkg.id}
                  value={pkg.id}
                  onSelect={() => {
                    onSelect(pkg);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <div className="font-medium">{pkg.name}</div>
                  <div className="text-xs text-muted-foreground truncate w-full">
                    {summary}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
