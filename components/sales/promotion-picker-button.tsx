"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronsUpDown, Plus, Tag } from "lucide-react";

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
import { listActivePromotions } from "@/lib/actions/promotions";
import type { Promotion } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

/** "10% off" / "$25.00 off" label for a promotion. */
export function promotionLabel(p: Promotion): string {
  return p.discount_type === "percent"
    ? `${p.discount_value}% off`
    : `${formatMoney(p.discount_value)} off`;
}

export function PromotionPickerButton({
  onSelect,
  label = "Add promotion",
}: {
  onSelect: (promotion: Promotion) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Promotion[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      setResults(await listActivePromotions());
    });
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" role="combobox" aria-expanded={open}>
          <Tag className="size-4" /> {label}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[360px] pointer-events-auto"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search promotions…" />
          <CommandList
            className="max-h-[300px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty>{isPending ? "Loading…" : "No active promotions."}</CommandEmpty>
            <CommandGroup>
              {results.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="size-4 opacity-40" />
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="tabular-nums text-xs">{promotionLabel(p)}</span>
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
