"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronsUpDown, Cog, Plus } from "lucide-react";

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
import {
  listTransServicesForPicker,
  type TransmissionService,
} from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";
import { transmissionKindLabel } from "@/lib/utils/transmission";

/** Effective sell price of a service line = Oil 1's sell price + Oil 2's sell
 *  price (when the service has a second oil) + any fixed labour — BOTH oils are
 *  charged, not just one. (client 2026-07-16: "the second oil, he is not doing
 *  its addition" — a prior version picked only the `default_oil`'s price instead
 *  of summing both; fixed.) */
export function transServicePrice(
  s: Pick<TransmissionService, "sell_price" | "sell_price_2" | "labour">,
): number {
  const oil1 = Number(s.sell_price) || 0;
  const oil2 = s.sell_price_2 != null ? Number(s.sell_price_2) || 0 : 0;
  return oil1 + oil2 + (Number(s.labour) || 0);
}

/** Display label for a service: name plus a Reg/Syn tag when meaningful. */
export function transServiceLabel(
  s: Pick<TransmissionService, "name" | "is_synthetic" | "service_kind">,
): string {
  const syn =
    s.service_kind === "coolant_flush" ? "" : s.is_synthetic ? " (Syn)" : " (Reg)";
  return `${s.name}${syn}`;
}

export function TransServicePickerButton({
  onSelect,
  label = "Add Trans & Diff service",
  excludeIds,
}: {
  onSelect: (service: TransmissionService) => void;
  label?: string;
  excludeIds?: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TransmissionService[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const data = await listTransServicesForPicker(q);
      setResults(data);
    });
  }, [q, open]);

  const visible = excludeIds ? results.filter((s) => !excludeIds.has(s.id)) : results;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" role="combobox" aria-expanded={open}>
          <Cog className="size-4" /> {label}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[440px] pointer-events-auto"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search Trans & Diff service…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList
            className="max-h-[300px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty>
              {isPending ? "Searching…" : "No matching services."}
            </CommandEmpty>
            <CommandGroup>
              {visible.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  onSelect={() => {
                    onSelect(s);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex items-start gap-2"
                >
                  <Plus className="size-4 mt-0.5 opacity-40" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-medium truncate">{transServiceLabel(s)}</div>
                      <div className="tabular-nums text-xs">
                        {formatMoney(transServicePrice(s))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {transmissionKindLabel(s.service_kind)}
                      {[s.oil_type_name, s.oil_type_name_2].filter(Boolean).length > 0
                        ? ` — ${[s.oil_type_name, s.oil_type_name_2].filter(Boolean).join(" + ")}`
                        : ""}
                      {s.litres ? ` · ${s.litres}${s.service_kind === "coolant_flush" ? "gal" : "L"}` : ""}
                      {s.container ? ` · ${s.container}` : ""}
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
