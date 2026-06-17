"use client";

import { useState } from "react";
import { Droplet, ChevronsUpDown } from "lucide-react";

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
import { excelOilLabel } from "@/lib/utils/oil-labels";
import { cn } from "@/lib/utils";
import type { OilType } from "@/lib/db/types";

export type OilContainer = "bulk" | "gallon";

// Adds an oil grade as a standalone line item. The caller decides the price /
// litres; here we just pick the oil + container. The list is passed in (oils are
// already loaded by the job form), so no fetch is needed.
export function OilPickerButton({
  oilTypes,
  onSelect,
}: {
  oilTypes: OilType[];
  onSelect: (oil: OilType, container: OilContainer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<OilContainer>("bulk");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" role="combobox" aria-expanded={open}>
          <Droplet className="size-4" /> Add oil
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start">
        <div className="flex items-center gap-1 border-b p-2">
          <span className="mr-1 text-xs text-muted-foreground">Container:</span>
          {(["bulk", "gallon"] as const).map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={container === c ? "default" : "outline"}
              className="h-7 capitalize"
              onClick={() => setContainer(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <Command>
          <CommandInput placeholder="Search oil grade…" />
          <CommandList>
            <CommandEmpty>No matching oils.</CommandEmpty>
            <CommandGroup>
              {oilTypes.map((oil) => {
                const label = excelOilLabel(oil.code, oil.name);
                const rate =
                  container === "gallon"
                    ? Number(oil.gallon_cost_per_litre)
                    : Number(oil.bulk_cost_per_litre);
                return (
                  <CommandItem
                    key={oil.id}
                    value={`${label} ${oil.code} ${oil.name}`}
                    onSelect={() => {
                      onSelect(oil, container);
                      setOpen(false);
                    }}
                    className={cn("flex items-center justify-between")}
                  >
                    <span>{label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      ${(Number.isFinite(rate) ? rate : 0).toFixed(2)}/L
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
