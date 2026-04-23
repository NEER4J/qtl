"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { searchVendors } from "@/lib/actions/vendors";
import type { Vendor } from "@/lib/db/types";
import { cn } from "@/lib/utils";

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
  const [results, setResults] = useState<Vendor[]>([]);
  const [isPending, startTransition] = useTransition();
  const cacheRef = useRef<Map<string, Vendor>>(new Map());

  const selected = value ? cacheRef.current.get(value) : null;

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const res = await searchVendors({
        q,
        category_id: categoryId ?? undefined,
        limit: 20,
      });
      if (res.ok) {
        setResults(res.data);
        for (const v of res.data) cacheRef.current.set(v.id, v);
      }
    });
  }, [q, open, categoryId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          type="button"
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
              {isPending ? "Searching…" : "No vendor found."}
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
