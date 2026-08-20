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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMoney } from "@/lib/utils/format";
import { excelOilLabel } from "@/lib/utils/oil-labels";
import { cn } from "@/lib/utils";
import type { OilType } from "@/lib/db/types";

export type OilContainer = "bulk" | "gallon";

/** Unit an oil line is sold in: bulk is charged per litre, gallon per container. */
export function oilUnitLabel(container: OilContainer): string {
  return container === "gallon" ? "gal" : "L";
}

/**
 * Per-unit rate charged for an oil line — $/litre for bulk, $/gallon for gallon
 * (oil_types.gallon_cost_per_litre stores the price of a whole container, not a
 * litre). The rate is taken from the BASE grade (is_base, e.g. 15W40) so every
 * oil is charged at the base price (client 2026-06-30 — "price should be created
 * using base price"); falls back to the picked oil's own rate when no base grade
 * is configured.
 */
export function oilLineRate(
  oilTypes: OilType[],
  oil: OilType,
  container: OilContainer,
): number {
  const priceOil = oilTypes.find((o) => o.is_base) ?? oil;
  const rate =
    container === "gallon"
      ? Number(priceOil.gallon_cost_per_litre)
      : Number(priceOil.bulk_cost_per_litre);
  return Number.isFinite(rate) ? rate : 0;
}

// Adds an oil grade as a standalone line item. The container and the quantity
// (litres for bulk, gallons for gallon) are chosen here so the picker can show
// what the line will actually cost before it is added.
export function OilPickerButton({
  oilTypes,
  onSelect,
}: {
  oilTypes: OilType[];
  onSelect: (oil: OilType, container: OilContainer, quantity: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<OilContainer>("bulk");
  // Kept as text so a half-typed "2." doesn't get clobbered mid-keystroke.
  const [qtyText, setQtyText] = useState("1");

  const parsedQty = Number(qtyText);
  const qty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
  const unit = oilUnitLabel(container);
  const baseOil = oilTypes.find((o) => o.is_base);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQtyText("1");
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" role="combobox" aria-expanded={open}>
          <Droplet className="size-4" /> Add oil
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[400px]" align="start">
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
          <span className="ml-auto flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Qty:</span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
              className="h-7 w-16 text-right tabular-nums"
              aria-label={`Quantity in ${unit}`}
            />
            <span className="text-xs text-muted-foreground w-6">{unit}</span>
          </span>
        </div>
        <Command>
          <CommandInput placeholder="Search oil grade…" />
          <CommandList>
            <CommandEmpty>No matching oils.</CommandEmpty>
            <CommandGroup>
              {oilTypes.map((oil) => {
                const label = excelOilLabel(oil.code, oil.name);
                const rate = oilLineRate(oilTypes, oil, container);
                return (
                  <CommandItem
                    key={oil.id}
                    value={`${label} ${oil.code} ${oil.name}`}
                    onSelect={() => {
                      onSelect(oil, container, qty);
                      setOpen(false);
                    }}
                    className={cn("flex items-center justify-between gap-2")}
                  >
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium tabular-nums">
                        {formatMoney(Math.round(rate * qty * 100) / 100)}
                      </span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {qty} {unit} × ${rate.toFixed(2)}/{unit}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {baseOil && (
          <p className="border-t px-2 py-1.5 text-[11px] text-muted-foreground">
            Every grade is charged at the base rate ({excelOilLabel(baseOil.code, baseOil.name)}).
            Quantity and price stay editable on the line.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
