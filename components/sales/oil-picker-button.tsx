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
import { oilLabel } from "@/lib/utils/oil-labels";
import { cn } from "@/lib/utils";
import type { OilGroup, OilType } from "@/lib/db/types";

export type OilContainer = "bulk" | "gallon";

/** Unit an oil line is sold in: bulk is charged per litre, gallon per container. */
export function oilUnitLabel(container: OilContainer): string {
  return container === "gallon" ? "gal" : "L";
}

/**
 * Per-unit rate charged for an oil line — $/litre for bulk, $/container for
 * gallon (oil_types.gallon_cost_per_litre stores the price of a whole
 * container, not a litre).
 *
 * The rate is a BASE price, not the oil's own cost (client 2026-06-30 — "price
 * should be created using base price"). There used to be exactly one base
 * grade for all oils, which meant a full-synthetic was offered at the 15W40
 * rate; since migration 0133 each oil belongs to an oil GROUP that carries its
 * own base price (client 2026-08-31). Everything else about the line is
 * unchanged.
 *
 * Fallback chain, so nothing moves before the groups are set up:
 *   1. the group's rate for this container,
 *   2. the single is_base grade's rate (the old behaviour),
 *   3. the picked oil's own rate (when no base grade is configured).
 * A group rate of null means "not set" and falls through; 0 is a real price.
 */
export function oilLineRate(
  oilTypes: OilType[],
  oil: OilType,
  container: OilContainer,
  oilGroups: OilGroup[] = [],
): number {
  const group = oil.oil_group_id
    ? oilGroups.find((g) => g.id === oil.oil_group_id)
    : undefined;
  const groupRate = group
    ? container === "gallon"
      ? group.gallon_price_per_container
      : group.bulk_price_per_litre
    : null;
  if (groupRate != null && Number.isFinite(Number(groupRate))) return Number(groupRate);

  const priceOil = oilTypes.find((o) => o.is_base) ?? oil;
  const rate =
    container === "gallon"
      ? Number(priceOil.gallon_cost_per_litre)
      : Number(priceOil.bulk_cost_per_litre);
  return Number.isFinite(rate) ? rate : 0;
}

/** The group an oil is priced by, for showing WHY a rate is what it is. */
export function oilLineGroup(oil: OilType, oilGroups: OilGroup[]): OilGroup | null {
  if (!oil.oil_group_id) return null;
  return oilGroups.find((g) => g.id === oil.oil_group_id) ?? null;
}

// Adds an oil grade as a standalone line item. The container and the quantity
// (litres for bulk, gallons for gallon) are chosen here so the picker can show
// what the line will actually cost before it is added.
export function OilPickerButton({
  oilTypes,
  oilGroups = [],
  onSelect,
}: {
  oilTypes: OilType[];
  oilGroups?: OilGroup[];
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
                const label = oilLabel(oil);
                const rate = oilLineRate(oilTypes, oil, container, oilGroups);
                const group = oilLineGroup(oil, oilGroups);
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
                    <span className="truncate">
                      {label}
                      {group && (
                        <span className="block text-[10px] text-muted-foreground">
                          {group.name}
                        </span>
                      )}
                    </span>
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
        {oilGroups.length > 0 ? (
          <p className="border-t px-2 py-1.5 text-[11px] text-muted-foreground">
            Each grade is charged at its oil group&apos;s base rate. Quantity and price stay
            editable on the line.
          </p>
        ) : baseOil ? (
          <p className="border-t px-2 py-1.5 text-[11px] text-muted-foreground">
            Every grade is charged at the base rate ({oilLabel(baseOil)}).
            Quantity and price stay editable on the line.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
