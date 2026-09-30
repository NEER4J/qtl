"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryLocation } from "@/lib/actions/inventory";
import { cn } from "@/lib/utils";
import {
  NO_LIMIT,
  isLowAnywhere,
  stockStatus,
  type StockLimit,
} from "@/lib/utils/stock-limits";

// The on-hand grid shared by the Parts and Oils tabs: one row per item, and for
// every location its count with that shop's own min and max beside it. A count
// is flagged against its own shop's thresholds — never against the total.

export interface StockTableRow {
  id: string;
  qtyByLocation: Record<string, number>;
  total: number;
  limitsByLocation: Record<string, StockLimit>;
}

type ActionResult = { ok: true } | { ok: false; error: string };

export function StockTable<Row extends StockTableRow>({
  rows: initialRows,
  locations,
  canEdit,
  canEditLimits,
  limitsSupported,
  fractional = false,
  leadHeaders,
  renderLead,
  matches,
  searchPlaceholder,
  noun,
  totalLabel = "Total",
  saveQty,
  saveLimits,
}: {
  rows: Row[];
  locations: InventoryLocation[];
  canEdit: boolean;
  /** Min/max thresholds are policy — owner/co_owner only. */
  canEditLimits: boolean;
  /** False until migration 0151 — the Min / Max columns stay read-only dashes. */
  limitsSupported: boolean;
  /** Litres (2 decimals) rather than whole units. */
  fractional?: boolean;
  /** Header cells for the columns that identify the item. */
  leadHeaders: ReactNode;
  /** The cells that identify the item, matching `leadHeaders`. */
  renderLead: (row: Row) => ReactNode;
  matches: (row: Row, query: string) => boolean;
  searchPlaceholder: string;
  /** "parts" / "oils", for the empty states. */
  noun: string;
  totalLabel?: string;
  saveQty: (id: string, locationId: string, qty: number) => Promise<ActionResult>;
  saveLimits: (
    id: string,
    locationId: string,
    limit: StockLimit,
  ) => Promise<ActionResult>;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [, startTransition] = useTransition();
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const editLimits = canEditLimits && limitsSupported;

  // Whole units, or litres to 2 decimals. NaN for input that isn't a number.
  const clamp = (n: number): number =>
    !Number.isFinite(n) ? NaN : Math.max(0, fractional ? Math.round(n * 100) / 100 : Math.floor(n));

  // Last server-confirmed value per cell, so we only save real changes and can
  // revert cleanly on error.
  const savedQtyRef = useRef<Map<string, number>>(
    new Map(
      initialRows.flatMap((r) =>
        locations.map((l) => [`${r.id}|${l.id}`, r.qtyByLocation[l.id] ?? 0] as const),
      ),
    ),
  );
  const savedLimitRef = useRef<Map<string, StockLimit>>(
    new Map(
      initialRows.flatMap((r) =>
        Object.entries(r.limitsByLocation).map(([locId, limit]) => [`${r.id}|${locId}`, limit] as const),
      ),
    ),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!lowOnly || isLowAnywhere(r)) && (!q || matches(r, q)));
  }, [rows, query, lowOnly, matches]);

  const lowCount = useMemo(() => rows.filter(isLowAnywhere).length, [rows]);

  const setLocalQty = (id: string, locationId: string, qty: number) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const qtyByLocation = { ...r.qtyByLocation, [locationId]: qty };
        const total = Object.values(qtyByLocation).reduce((a, b) => a + b, 0);
        return { ...r, qtyByLocation, total: Math.round(total * 100) / 100 };
      }),
    );
  };

  const commitQty = (id: string, locationId: string, raw: string) => {
    const cellKey = `${id}|${locationId}`;
    const prev = savedQtyRef.current.get(cellKey) ?? 0;
    const qty = clamp(Number(raw));
    if (!Number.isFinite(qty)) {
      setLocalQty(id, locationId, prev); // bad input -> restore
      return;
    }
    setLocalQty(id, locationId, qty);
    if (qty === prev) return; // normalized display, nothing to save
    setSavingCell(cellKey);
    startTransition(async () => {
      const res = await saveQty(id, locationId, qty);
      setSavingCell(null);
      if (!res.ok) {
        toast.error(res.error);
        setLocalQty(id, locationId, prev); // revert
        return;
      }
      savedQtyRef.current.set(cellKey, qty);
      toast.success("Stock updated");
    });
  };

  const setLocalLimit = (id: string, locationId: string, limit: StockLimit) => {
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, limitsByLocation: { ...r.limitsByLocation, [locationId]: limit } }
          : r,
      ),
    );
  };

  // Min/max cell — empty clears that threshold. The other side is sent as last
  // saved, so a half-typed neighbour can't ride along.
  const commitLimit = (id: string, locationId: string, side: "min" | "max", raw: string) => {
    const cellKey = `${id}|${locationId}`;
    const prev = savedLimitRef.current.get(cellKey) ?? NO_LIMIT;
    const parsed = raw.trim() === "" ? null : clamp(Number(raw));
    if (parsed != null && !Number.isFinite(parsed)) {
      setLocalLimit(id, locationId, prev); // bad input -> restore
      return;
    }
    const next: StockLimit = { ...prev, [side]: parsed };
    setLocalLimit(id, locationId, next);
    if (parsed === prev[side]) return;
    startTransition(async () => {
      const res = await saveLimits(id, locationId, next);
      if (!res.ok) {
        toast.error(res.error);
        setLocalLimit(id, locationId, prev); // revert
        return;
      }
      savedLimitRef.current.set(cellKey, next);
      toast.success("Thresholds saved");
    });
  };

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };
  const numberProps = fractional
    ? ({ step: "0.01", inputMode: "decimal" } as const)
    : ({ inputMode: "numeric" } as const);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 print:hidden">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={lowOnly} onCheckedChange={(v) => setLowOnly(v === true)} />
          Low stock only
          {lowCount > 0 && (
            <Badge variant="destructive" className="tabular-nums">{lowCount}</Badge>
          )}
        </label>
      </div>

      <div className="rounded-lg border max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible print:border-0">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {leadHeaders}
              {locations.map((l) => (
                <TableHead key={l.id} colSpan={3} className="border-l text-center">
                  {l.name}
                </TableHead>
              ))}
              <TableHead rowSpan={2} className="border-l text-right min-w-[80px]">
                {totalLabel}
              </TableHead>
            </TableRow>
            <TableRow>
              {locations.flatMap((l) => [
                <TableHead key={`${l.id}-qty`} className="border-l text-right text-xs min-w-[92px]">
                  On hand
                </TableHead>,
                <TableHead key={`${l.id}-min`} className="text-right text-xs min-w-[72px]">
                  Min
                </TableHead>,
                <TableHead key={`${l.id}-max`} className="text-right text-xs min-w-[72px]">
                  Max
                </TableHead>,
              ])}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3 + locations.length * 3}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? `No ${noun} in the catalogue yet.`
                    : lowOnly && !query
                      ? "Nothing is below its minimum at any location. 🎉"
                      : `No ${noun} match your search.`}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  {renderLead(r)}
                  {locations.flatMap((l) => {
                    const cellKey = `${r.id}|${l.id}`;
                    const qty = r.qtyByLocation[l.id] ?? 0;
                    const limit = r.limitsByLocation[l.id] ?? NO_LIMIT;
                    const status = stockStatus(qty, limit);
                    return [
                      <TableCell
                        key={`${l.id}-qty`}
                        className={cn(
                          "border-l text-right",
                          status === "low" && "bg-red-50 dark:bg-red-950/30",
                          status === "over" && "bg-amber-50 dark:bg-amber-950/30",
                        )}
                      >
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {status === "low" && (
                            <Badge variant="destructive" className="text-[10px]">Low</Badge>
                          )}
                          {status === "over" && (
                            <Badge className="bg-amber-500 text-[10px] hover:bg-amber-500">Over</Badge>
                          )}
                          {canEdit ? (
                            <>
                              <Input
                                type="number"
                                min={0}
                                {...numberProps}
                                value={qty}
                                disabled={savingCell === cellKey}
                                onChange={(e) => setLocalQty(r.id, l.id, clamp(Number(e.target.value) || 0))}
                                onBlur={(e) => commitQty(r.id, l.id, e.target.value)}
                                onKeyDown={blurOnEnter}
                                className="h-8 w-20 text-right tabular-nums print:hidden"
                              />
                              {/* Print shows the number, not an edit box. */}
                              <span className="hidden print:inline tabular-nums">{qty}</span>
                            </>
                          ) : (
                            <span className="tabular-nums">{qty}</span>
                          )}
                        </span>
                      </TableCell>,
                      ...(["min", "max"] as const).map((side) => (
                        <TableCell key={`${l.id}-${side}`} className="text-right">
                          {editLimits ? (
                            <>
                              <Input
                                type="number"
                                min={0}
                                {...numberProps}
                                value={limit[side] ?? ""}
                                placeholder="—"
                                aria-label={`${side === "min" ? "Minimum" : "Maximum"} at ${l.name}`}
                                onChange={(e) =>
                                  setLocalLimit(r.id, l.id, {
                                    ...limit,
                                    [side]:
                                      e.target.value === "" ? null : clamp(Number(e.target.value) || 0),
                                  })
                                }
                                onBlur={(e) => commitLimit(r.id, l.id, side, e.target.value)}
                                onKeyDown={blurOnEnter}
                                className="h-8 w-16 ml-auto text-right tabular-nums text-muted-foreground print:hidden"
                              />
                              <span className="hidden print:inline tabular-nums">{limit[side] ?? "—"}</span>
                            </>
                          ) : (
                            <span className="tabular-nums text-muted-foreground">{limit[side] ?? "—"}</span>
                          )}
                        </TableCell>
                      )),
                    ];
                  })}
                  <TableCell className="border-l text-right font-medium tabular-nums">{r.total}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
