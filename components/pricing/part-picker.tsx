"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

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
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { prefetchPreloadedList, usePreloadedList } from "@/hooks/use-preloaded-list";
import { listPartsForPicker } from "@/lib/actions/pricing";
import type { PartForPicker } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const PARTS_URL = "/api/picker/parts";
// Prices can change; a copy older than this is refreshed when a picker opens.
const PARTS_MAX_AGE_MS = 60_000;
// Rows rendered at once, so each keystroke stays cheap.
const MAX_VISIBLE = 100;

/** Load the catalogue ahead of the first click (the sales form calls this on mount). */
export function prefetchPickerParts(): void {
  prefetchPreloadedList(PARTS_URL, PARTS_MAX_AGE_MS);
}

export function PartPickerButton({
  onSelect,
  label = "Add part from catalog",
  excludeIds,
  preload = false,
}: {
  onSelect: (part: PartForPicker) => void;
  label?: string;
  /** Hide these part_ids from the result list (e.g. parts already in the package). */
  excludeIds?: ReadonlySet<string>;
  /** Search the whole catalogue in the browser (sales form) instead of one
   *  server action per settled keystroke. Left off in settings screens, where a
   *  part edited a moment ago must show fresh. */
  preload?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const remote = useDebouncedSearch<PartForPicker>({
    open: open && !preload,
    query: q,
    fetcher: (query) => listPartsForPicker(query),
  });
  const catalogue = usePreloadedList<PartForPicker[]>(PARTS_URL, {
    open: open && preload,
    maxAgeMs: PARTS_MAX_AGE_MS,
  });

  // Lower-cased once per load, not on every keystroke.
  const indexed = useMemo(
    () =>
      (catalogue.data ?? []).map((part) => ({
        part,
        haystack: `${part.part_number ?? ""} ${part.description ?? ""} ${part.brand ?? ""}`.toLowerCase(),
      })),
    [catalogue.data],
  );

  // listPartsForPicker's rule: every word in the part number, description or
  // brand. The list arrives in its order (brand, part number).
  const local = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out: PartForPicker[] = [];
    for (const row of indexed) {
      if (excludeIds?.has(row.part.id)) continue;
      if (!words.every((w) => row.haystack.includes(w))) continue;
      out.push(row.part);
      if (out.length === MAX_VISIBLE) break;
    }
    return out;
  }, [indexed, q, excludeIds]);

  const visible = preload
    ? local
    : excludeIds
      ? remote.results.filter((p) => !excludeIds.has(p.id))
      : remote.results;
  const emptyText = preload
    ? catalogue.data === null
      ? catalogue.failed
        ? "Couldn't load the catalogue. Close and reopen to retry."
        : "Loading parts…"
      : "No matching parts."
    : remote.searching
      ? "Searching…"
      : "No matching parts.";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          onPointerEnter={preload ? prefetchPickerParts : undefined}
          onFocus={preload ? prefetchPickerParts : undefined}
        >
          <Plus className="size-4" /> {label}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[420px] pointer-events-auto"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search part number, brand, description…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList
            className="max-h-[280px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {visible.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex items-start gap-2"
                >
                  <Check className={cn("size-4 mt-0.5 opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-medium truncate">
                        {p.brand} {p.part_number}
                      </div>
                      <div className="tabular-nums text-xs">
                        {formatMoney(Number(p.list_price) || 0)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.category}
                      {p.description ? ` — ${p.description}` : ""}
                    </div>
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
