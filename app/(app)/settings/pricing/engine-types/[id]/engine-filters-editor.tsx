"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  deleteEngineFilter,
  searchPartsForEngine,
  upsertEngineFilter,
} from "@/lib/actions/pricing";
import type { EngineFilterRow } from "@/lib/actions/pricing";
import type { Part } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function EngineFiltersEditor({
  engineId,
  filters,
}: {
  engineId: string;
  filters: EngineFilterRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Part[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [newQty, setNewQty] = useState("1");
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [searchPending, startSearchTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();
  const existingPartIds = useRef(new Set(filters.map((f) => f.part_id)));

  useEffect(() => {
    existingPartIds.current = new Set(filters.map((f) => f.part_id));
  }, [filters]);

  useEffect(() => {
    if (!pickerOpen) return;
    startSearchTransition(async () => {
      const res = await searchPartsForEngine({ q });
      if (res.ok) setResults(res.data);
    });
  }, [q, pickerOpen]);

  const resetAddRow = () => {
    setAdding(false);
    setPickerOpen(false);
    setQ("");
    setSelectedPart(null);
    setNewQty("1");
  };

  const onAdd = () => {
    if (!selectedPart) {
      toast.error("Pick a part first.");
      return;
    }
    const qty = Number(newQty);
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Quantity must be a whole number ≥ 1.");
      return;
    }
    startSaveTransition(async () => {
      const res = await upsertEngineFilter({
        engine_type_id: engineId,
        part_id: selectedPart.id,
        quantity: qty,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Filter added");
      resetAddRow();
    });
  };

  const onUpdateQty = (row: EngineFilterRow, qty: number) => {
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Quantity must be a whole number ≥ 1.");
      return;
    }
    if (qty === row.quantity) return;
    setRowPending(row.id);
    startSaveTransition(async () => {
      const res = await upsertEngineFilter({
        engine_type_id: engineId,
        part_id: row.part_id,
        quantity: qty,
      });
      setRowPending(null);
      if (!res.ok) toast.error(res.error);
      else toast.success("Quantity updated");
    });
  };

  const onDelete = (row: EngineFilterRow) => {
    setRowPending(row.id);
    startSaveTransition(async () => {
      const res = await deleteEngineFilter({ id: row.id });
      setRowPending(null);
      if (!res.ok) toast.error(res.error);
      else toast.success("Filter removed");
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-40">Part #</TableHead>
              <TableHead className="w-32">Brand</TableHead>
              <TableHead className="w-32">Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28 text-right">Quantity</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  No filters on this engine yet. Add one below.
                </TableCell>
              </TableRow>
            ) : (
              filters.map((f) => (
                <EngineFilterRowView
                  key={f.id}
                  row={f}
                  disabled={rowPending === f.id || savePending}
                  onUpdateQty={onUpdateQty}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {adding ? (
        <div className="flex flex-wrap items-end gap-2 p-3 border rounded-md bg-muted/30">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs font-medium block mb-1">Part</label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  type="button"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedPart
                      ? `${selectedPart.part_number} · ${selectedPart.brand}`
                      : "Search parts…"}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search part number, description, brand…"
                    value={q}
                    onValueChange={setQ}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searchPending ? "Searching…" : "No parts found."}
                    </CommandEmpty>
                    <CommandGroup heading="Parts">
                      {results.map((p) => {
                        const already = existingPartIds.current.has(p.id);
                        return (
                          <CommandItem
                            key={p.id}
                            value={p.id}
                            disabled={already}
                            onSelect={() => {
                              if (already) return;
                              setSelectedPart(p);
                              setPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                selectedPart?.id === p.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-1 flex-col overflow-hidden">
                              <span className="truncate font-medium font-mono text-sm">
                                {p.part_number} · {p.brand}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {p.category}
                                {p.description ? ` — ${p.description}` : ""}
                                {already ? " (already on engine)" : ""}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="w-28">
            <label className="text-xs font-medium block mb-1">Quantity</label>
            <Input
              type="number"
              min="1"
              step="1"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onAdd} disabled={savePending || !selectedPart}>
              {savePending ? "Adding…" : "Add"}
            </Button>
            <Button type="button" variant="outline" onClick={resetAddRow} disabled={savePending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add filter
        </Button>
      )}
    </div>
  );
}

function EngineFilterRowView({
  row,
  disabled,
  onUpdateQty,
  onDelete,
}: {
  row: EngineFilterRow;
  disabled: boolean;
  onUpdateQty: (row: EngineFilterRow, qty: number) => void;
  onDelete: (row: EngineFilterRow) => void;
}) {
  const [qty, setQty] = useState(String(row.quantity));
  useEffect(() => {
    setQty(String(row.quantity));
  }, [row.quantity]);

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{row.part.part_number}</TableCell>
      <TableCell>{row.part.brand}</TableCell>
      <TableCell className="text-sm">{row.part.category}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{row.part.description ?? "—"}</TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min="1"
          step="1"
          className="w-20 ml-auto text-right"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={() => onUpdateQty(row, Number(qty))}
          disabled={disabled}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(row)}
          disabled={disabled}
          title="Remove filter"
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
