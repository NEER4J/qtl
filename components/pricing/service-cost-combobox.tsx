"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/format";

import { ServiceCostFormDialog } from "@/app/(app)/settings/pricing/service-costs/service-cost-form-dialog";

/**
 * Labour-charge picker. Searches the service_costs reference list; clicking
 * "Add labour charge" opens the full service-cost form so the user can enter
 * code + cost (which the combobox can't collect inline).
 */
export function ServiceCostCombobox({
  value,
  onChange,
  serviceCosts,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  serviceCosts: ServiceCost[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const selected = useMemo(
    () => serviceCosts.find((sc) => sc.id === value) ?? null,
    [value, serviceCosts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = serviceCosts.filter((sc) => sc.active || sc.id === value);
    if (!q) return base;
    return base.filter(
      (sc) =>
        sc.code.toLowerCase().includes(q) ||
        sc.name.toLowerCase().includes(q),
    );
  }, [query, serviceCosts, value]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            type="button"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? `${selected.code} — ${selected.name}` : "None (no labour charge)"}
            </span>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              {selected && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear"
                  className="opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(null);
                    }
                  }}
                >
                  <X className="size-4" />
                </span>
              )}
              <ChevronsUpDown className="size-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search labour charges by code or name…"
              value={query}
              onValueChange={setQuery}
            />
            {/* Always-visible "Add new" row at the top. */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setAddOpen(true);
              }}
              className="flex items-center gap-2 w-full border-b px-3 py-2 text-sm text-left bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <Plus className="size-4 text-primary" />
              <span className="flex-1 truncate">
                Add labour charge{query.trim() ? `: "${query.trim()}"` : "…"}
              </span>
            </button>
            <CommandList>
              <CommandEmpty>
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {serviceCosts.length === 0
                    ? "No labour charges yet. Click the button above to add one."
                    : "No matches. Try a different search."}
                </div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === null ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="text-muted-foreground italic">None</span>
                </CommandItem>
                {filtered.map((sc) => (
                  <CommandItem
                    key={sc.id}
                    value={sc.id}
                    onSelect={() => {
                      onChange(sc.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === sc.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <span className="truncate font-medium font-mono text-sm">
                        {sc.code}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {sc.name} · {formatMoney(sc.cost)}
                        {!sc.active ? " · inactive" : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ServiceCostFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
      />
    </>
  );
}
