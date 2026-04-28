"use client";

import { useEffect, useState, useTransition } from "react";
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
import { listPartsForPicker } from "@/lib/actions/pricing";
import type { Part } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function PartPickerButton({
  onSelect,
  label = "Add part from catalog",
  excludeIds,
}: {
  onSelect: (part: Part) => void;
  label?: string;
  /** Hide these part_ids from the result list (e.g. parts already in the package). */
  excludeIds?: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Part[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const data = await listPartsForPicker(q);
      setResults(data);
    });
  }, [q, open]);

  const visible = excludeIds ? results.filter((p) => !excludeIds.has(p.id)) : results;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" role="combobox" aria-expanded={open}>
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
            <CommandEmpty>{isPending ? "Searching…" : "No matching parts."}</CommandEmpty>
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
