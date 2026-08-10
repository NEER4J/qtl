"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  setOilLocationStock,
  setOilStockLimits,
  type InventoryOilRow,
  type OilInventoryData,
} from "@/lib/actions/inventory";

import { stockStatus } from "./inventory-table";

function withTotal(row: InventoryOilRow): InventoryOilRow {
  const total = Object.values(row.qtyByLocation).reduce((a, b) => a + b, 0);
  return { ...row, total: Math.round(total * 100) / 100 };
}

// Oils are measured in litres, so fractional quantities are allowed (unlike the
// integer part counts). Clamp to ≥ 0 and 2 decimals.
function clampQty(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : NaN;
}

export function OilInventoryTable({
  data,
  canEdit,
  canEditLimits = false,
}: {
  data: OilInventoryData;
  canEdit: boolean;
  /** Min/max thresholds are policy — owner/co_owner only (oil_types_write RLS). */
  canEditLimits?: boolean;
}) {
  const { locations } = data;
  const [rows, setRows] = useState<InventoryOilRow[]>(data.oils);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [, startTransition] = useTransition();
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const savedRef = useRef<Map<string, number>>(
    new Map(
      data.oils.flatMap((o) =>
        locations.map((l) => [`${o.id}|${l.id}`, o.qtyByLocation[l.id] ?? 0] as const),
      ),
    ),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (lowOnly && stockStatus(r.total, r.min_stock_litres, r.max_stock_litres) !== "low") {
        return false;
      }
      if (!q) return true;
      return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
  }, [rows, query, lowOnly]);

  const lowCount = useMemo(
    () =>
      rows.filter((r) => stockStatus(r.total, r.min_stock_litres, r.max_stock_litres) === "low")
        .length,
    [rows],
  );

  // Last server-confirmed min/max per oil.
  const savedLimitsRef = useRef<Map<string, number | null>>(
    new Map(
      data.oils.flatMap((o) => [
        [`${o.id}|min_stock_litres`, o.min_stock_litres] as const,
        [`${o.id}|max_stock_litres`, o.max_stock_litres] as const,
      ]),
    ),
  );

  const setLocalLimit = (
    oilId: string,
    field: "min_stock_litres" | "max_stock_litres",
    value: number | null,
  ) => {
    setRows((rs) => rs.map((r) => (r.id === oilId ? { ...r, [field]: value } : r)));
  };

  // Min/max threshold cell — empty clears the threshold (null). Litres, so
  // fractional values are allowed (same as the counts).
  const commitLimit = (
    oilId: string,
    field: "min_stock_litres" | "max_stock_litres",
    raw: string,
  ) => {
    const key = `${oilId}|${field}`;
    const prev = savedLimitsRef.current.get(key) ?? null;
    const parsed = raw.trim() === "" ? null : Math.round(Number(raw) * 100) / 100;
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      setLocalLimit(oilId, field, prev); // bad input -> restore
      return;
    }
    if (parsed === prev) {
      setLocalLimit(oilId, field, parsed);
      return;
    }
    const otherField = field === "min_stock_litres" ? "max_stock_litres" : "min_stock_litres";
    const otherSaved = savedLimitsRef.current.get(`${oilId}|${otherField}`) ?? null;
    setLocalLimit(oilId, field, parsed);
    startTransition(async () => {
      const res = await setOilStockLimits({
        oil_type_id: oilId,
        min_stock_litres: field === "min_stock_litres" ? parsed : otherSaved,
        max_stock_litres: field === "max_stock_litres" ? parsed : otherSaved,
      });
      if (!res.ok) {
        toast.error(res.error);
        setLocalLimit(oilId, field, prev); // revert
        return;
      }
      savedLimitsRef.current.set(key, parsed);
      toast.success("Thresholds saved");
    });
  };

  const setLocalQty = (oilId: string, locationId: string, qty: number) => {
    setRows((rs) =>
      rs.map((r) =>
        r.id === oilId
          ? withTotal({ ...r, qtyByLocation: { ...r.qtyByLocation, [locationId]: qty } })
          : r,
      ),
    );
  };

  const commitCell = (oilId: string, locationId: string, raw: string) => {
    const cellKey = `${oilId}|${locationId}`;
    const prev = savedRef.current.get(cellKey) ?? 0;
    const qty = clampQty(Number(raw));
    if (!Number.isFinite(qty)) {
      setLocalQty(oilId, locationId, prev); // bad input -> restore
      return;
    }
    if (qty === prev) {
      setLocalQty(oilId, locationId, qty); // normalize display, no save
      return;
    }
    setLocalQty(oilId, locationId, qty);
    setSavingCell(cellKey);
    startTransition(async () => {
      const res = await setOilLocationStock({
        oil_type_id: oilId,
        location_id: locationId,
        qty,
      });
      setSavingCell(null);
      if (!res.ok) {
        toast.error(res.error);
        setLocalQty(oilId, locationId, prev); // revert
        return;
      }
      savedRef.current.set(cellKey, qty);
      toast.success("Stock updated");
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 print:hidden">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search oil code or name…"
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
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Oil</TableHead>
              <TableHead className="min-w-[100px]">Type</TableHead>
              {locations.map((l) => (
                <TableHead key={l.id} className="text-right min-w-[96px]">
                  {l.name}
                </TableHead>
              ))}
              <TableHead className="text-right min-w-[80px]">Total (L)</TableHead>
              <TableHead className="text-right min-w-[72px]">Min (L)</TableHead>
              <TableHead className="text-right min-w-[72px]">Max (L)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5 + locations.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? "No oils in the catalogue yet."
                    : lowOnly && !query
                      ? "Nothing is below its minimum. 🎉"
                      : "No oils match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.code}</div>
                    <div className="text-xs text-muted-foreground">{r.name}</div>
                  </TableCell>
                  <TableCell>
                    {r.is_engine_oil ? (
                      <Badge variant="secondary" className="text-xs">Engine oil</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Other fluid</Badge>
                    )}
                  </TableCell>
                  {locations.map((l) => {
                    const cellKey = `${r.id}|${l.id}`;
                    const qty = r.qtyByLocation[l.id] ?? 0;
                    return (
                      <TableCell key={l.id} className="text-right">
                        {canEdit ? (
                          <>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              value={qty}
                              disabled={savingCell === cellKey}
                              onChange={(e) =>
                                setLocalQty(r.id, l.id, clampQty(Number(e.target.value) || 0))
                              }
                              onBlur={(e) => commitCell(r.id, l.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                              className="h-8 w-20 ml-auto text-right tabular-nums print:hidden"
                            />
                            {/* Print shows the number, not an edit box. */}
                            <span className="hidden print:inline tabular-nums">{qty}</span>
                          </>
                        ) : (
                          <span className="tabular-nums">{qty}</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className={cn("text-right font-medium tabular-nums")}>
                    <span className="inline-flex items-center gap-1.5">
                      {stockStatus(r.total, r.min_stock_litres, r.max_stock_litres) === "low" && (
                        <Badge variant="destructive" className="text-[10px]">Low</Badge>
                      )}
                      {stockStatus(r.total, r.min_stock_litres, r.max_stock_litres) === "over" && (
                        <Badge className="bg-amber-500 text-[10px] hover:bg-amber-500">Over</Badge>
                      )}
                      {r.total}
                    </span>
                  </TableCell>
                  {(["min_stock_litres", "max_stock_litres"] as const).map((field) => (
                    <TableCell key={field} className="text-right">
                      {canEditLimits ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={r[field] ?? ""}
                          placeholder="—"
                          onChange={(e) =>
                            setLocalLimit(
                              r.id,
                              field,
                              e.target.value === "" ? null : clampQty(Number(e.target.value) || 0),
                            )
                          }
                          onBlur={(e) => commitLimit(r.id, field, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="h-8 w-16 ml-auto text-right tabular-nums print:hidden"
                        />
                      ) : (
                        <span className="tabular-nums text-muted-foreground">
                          {r[field] ?? "—"}
                        </span>
                      )}
                      {canEditLimits && (
                        <span className="hidden print:inline tabular-nums">{r[field] ?? "—"}</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
