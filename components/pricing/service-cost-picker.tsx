"use client";

import { useState } from "react";
import { Plus, Wrench, ChevronsUpDown } from "lucide-react";

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
import type { ServiceCost } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

/**
 * Drop a Service (labour) cost onto a sales job as a line item. The catalogue
 * is the same one managed at Settings → Pricing → Service costs; selecting one
 * adds a taxable line priced at its labour cost.
 */
export function ServiceCostPickerButton({
  serviceCosts,
  onSelect,
  label = "Add labour / service",
}: {
  serviceCosts: ServiceCost[];
  onSelect: (serviceCost: ServiceCost) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" role="combobox" aria-expanded={open}>
          <Wrench className="size-4" /> {label}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[360px] pointer-events-auto"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search labour / service…" />
          <CommandList
            className="max-h-[280px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty>No service costs found.</CommandEmpty>
            <CommandGroup>
              {serviceCosts.map((sc) => (
                <CommandItem
                  key={sc.id}
                  value={`${sc.name} ${sc.code}`}
                  onSelect={() => {
                    onSelect(sc);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Plus className="size-3.5 opacity-50 shrink-0" />
                    <span className="truncate">{sc.name}</span>
                  </span>
                  <span className="tabular-nums text-xs">{formatMoney(Number(sc.cost) || 0)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
