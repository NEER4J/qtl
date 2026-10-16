"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";

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
import { searchVendors } from "@/lib/actions/vendors";
import type { Vendor } from "@/lib/db/types";
import { cn } from "@/lib/utils";

// Every active vendor is loaded once (app/api/picker/vendors) and searched in
// the browser. Vendors are created from this form, so the copy is refreshed in
// the background on every open, and a search with no local match still asks
// the server, so a vendor added a moment ago is never offered as "Create new".
const VENDORS_URL = "/api/picker/vendors";
const VENDORS_MAX_AGE_MS = 0;
const MAX_VISIBLE = 50;

// Hover / focus warm the list at most this often; opening always refreshes.
function prefetchVendors() {
  prefetchPreloadedList(VENDORS_URL, 30_000);
}

export function VendorComboBox({
  value,
  onChange,
  onSelectVendor,
  onCreateNew,
  defaultName,
  categoryId,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  onSelectVendor?: (vendor: Vendor) => void;
  onCreateNew?: (name: string) => void;
  defaultName: string;
  categoryId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const cacheRef = useRef<Map<string, Vendor>>(new Map());

  const selected = value ? cacheRef.current.get(value) : null;

  const list = usePreloadedList<Vendor[]>(VENDORS_URL, { open, maxAgeMs: VENDORS_MAX_AGE_MS });
  // searchVendors' rules (name, and the expense category when one is set),
  // with each word allowed anywhere in the name.
  const local = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out: Vendor[] = [];
    for (const v of list.data ?? []) {
      if (categoryId && v.category_id !== categoryId) continue;
      const name = v.name.toLowerCase();
      if (!words.every((w) => name.includes(w))) continue;
      out.push(v);
      if (out.length === MAX_VISIBLE) break;
    }
    return out;
  }, [list.data, q, categoryId]);
  const showLocal = list.data !== null && (local.length > 0 || !q.trim());

  const remote = useDebouncedSearch<Vendor>({
    open: open && !showLocal,
    query: q,
    // Changing the expense category re-scopes the vendor list, so it has to
    // re-trigger the search the same way a keystroke does.
    deps: [categoryId],
    fetcher: async (query) => {
      const res = await searchVendors({
        q: query,
        category_id: categoryId ?? undefined,
        limit: 20,
      });
      if (!res.ok) return [];
      for (const v of res.data) cacheRef.current.set(v.id, v);
      return res.data;
    },
  });
  const results = showLocal ? local : remote.results;
  const searching = !showLocal && remote.searching;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          type="button"
          onPointerEnter={prefetchVendors}
          onFocus={prefetchVendors}
        >
          <span className="truncate">
            {selected?.name ?? defaultName ?? "Search vendor…"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by vendor name…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>
              {searching ? "Searching…" : "No vendor found."}
            </CommandEmpty>
            <CommandGroup heading="Vendors">
              {results.map((v) => (
                <CommandItem
                  key={v.id}
                  value={v.id}
                  onSelect={() => {
                    cacheRef.current.set(v.id, v);
                    onChange(v.id);
                    onSelectVendor?.(v);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === v.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <span className="truncate font-medium">{v.name}</span>
                    {v.account_no && (
                      <span className="truncate text-xs text-muted-foreground font-mono">
                        #{v.account_no}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {onCreateNew && q.trim().length > 0 && (
                <CommandItem
                  value={`__create__${q}`}
                  onSelect={() => {
                    onCreateNew(q.trim());
                    setOpen(false);
                  }}
                >
                  <UserPlus className="mr-2 size-4" />
                  <span>Create new: <strong>{q}</strong></span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
