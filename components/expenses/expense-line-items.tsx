"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronsUpDown, Package, Trash2 } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listPartsForExpensePicker,
  type ExpensePartPickerRow,
} from "@/lib/actions/expenses";
import { formatDate, formatMoney } from "@/lib/utils/format";

export interface ExpenseLineItem {
  /** Local-only client id used for React keys; not persisted. */
  client_id: string;
  /** When set, the row was loaded from the server. */
  id?: string;
  part_id: string | null;
  vendor_part_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  /** Snapshot of the part's last buying price at the moment it was picked,
   *  shown in the row so the user can see how today's unit_cost compares. */
  last_buying_price?: number | null;
}

export function lineItemsSubTotal(items: ExpenseLineItem[]): number {
  return items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0),
    0,
  );
}

function makeClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newExpenseLineItem(partial: Partial<ExpenseLineItem> = {}): ExpenseLineItem {
  return {
    client_id: makeClientId(),
    part_id: null,
    vendor_part_id: null,
    description: "",
    quantity: 1,
    unit_cost: 0,
    last_buying_price: null,
    ...partial,
  };
}

function PartsCatalogPicker({
  onPick,
}: {
  onPick: (part: ExpensePartPickerRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ExpensePartPickerRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      try {
        const data = await listPartsForExpensePicker(q);
        setResults(data);
      } catch {
        setResults([]);
      }
    });
  }, [q, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
        >
          <Package className="size-4" /> Add part from catalog
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[640px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by part #, brand, description…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList className="max-h-[360px]">
            <CommandEmpty>{isPending ? "Searching…" : "No matching parts."}</CommandEmpty>
            <CommandGroup>
              <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground grid grid-cols-[1fr_auto] gap-2">
                <span>Part</span>
                <span className="text-right pr-1">Last buying price</span>
              </div>
              {results.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.part_number} ${p.brand} ${p.description ?? ""}`}
                  onSelect={() => {
                    onPick(p);
                    setOpen(false);
                    setQ("");
                  }}
                  className="grid grid-cols-[1fr_auto] gap-2 items-start"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p.part_number} <span className="text-muted-foreground">— {p.brand}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.description || p.category}
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    {p.last_buying_price != null ? (
                      <>
                        <div className="text-sm font-medium">
                          {formatMoney(p.last_buying_price)}
                        </div>
                        {p.last_buying_date && (
                          <div className="text-[10px] text-muted-foreground">
                            {formatDate(p.last_buying_date)}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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

export function ExpenseLineItems({
  items,
  onChange,
}: {
  items: ExpenseLineItem[];
  onChange: (next: ExpenseLineItem[]) => void;
}) {
  const addPart = (p: ExpensePartPickerRow) => {
    const unit_cost = p.last_buying_price ?? p.cost ?? 0;
    onChange([
      ...items,
      newExpenseLineItem({
        part_id: p.id,
        vendor_part_id: null,
        description: `${p.brand} ${p.part_number}${p.description ? ` — ${p.description}` : ""}`,
        quantity: 1,
        unit_cost,
        last_buying_price: p.last_buying_price,
      }),
    ]);
  };

  const removeRow = (clientId: string) => {
    onChange(items.filter((x) => x.client_id !== clientId));
  };

  const patchRow = (clientId: string, patch: Partial<ExpenseLineItem>) => {
    onChange(items.map((x) => (x.client_id === clientId ? { ...x, ...patch } : x)));
  };

  const total = lineItemsSubTotal(items);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <PartsCatalogPicker onPick={addPart} />
        <div className="text-xs text-muted-foreground">
          Pick a part to add a row. Non-itemised expenses (rent, utilities) can
          leave items empty and enter Sub Total directly below.
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border p-4 text-sm text-center text-muted-foreground">
          No line items yet. Add a part from the catalog above.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Unit cost</TableHead>
                <TableHead className="w-32 text-right">Last buying price</TableHead>
                <TableHead className="w-32 text-right">Line total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const qty = Number(row.quantity) || 0;
                const cost = Number(row.unit_cost) || 0;
                const lineTotal = qty * cost;
                const last = row.last_buying_price;
                const drift =
                  last != null && last > 0 ? (cost - last) / last : null;
                return (
                  <TableRow key={row.client_id}>
                    <TableCell>
                      <Input
                        value={row.description}
                        onChange={(e) => patchRow(row.client_id, { description: e.target.value })}
                        placeholder="e.g. 5W30 oil — 5L"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-right"
                        value={row.quantity}
                        onChange={(e) =>
                          patchRow(row.client_id, { quantity: Number(e.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        className="text-right"
                        value={row.unit_cost}
                        onChange={(e) =>
                          patchRow(row.client_id, { unit_cost: Number(e.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {last != null ? (
                        <div className="flex flex-col items-end">
                          <span>{formatMoney(last)}</span>
                          {drift != null && Math.abs(drift) >= 0.005 && (
                            <span
                              className={
                                drift > 0
                                  ? "text-[10px] text-amber-600"
                                  : "text-[10px] text-emerald-600"
                              }
                            >
                              {drift > 0 ? "+" : ""}
                              {(drift * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(lineTotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.client_id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end px-4 py-2 border-t bg-muted/30 text-sm">
            <span className="text-muted-foreground">Items total</span>
            <span className="ml-3 font-medium tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
