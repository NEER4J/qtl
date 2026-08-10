"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  setPartLocationStock,
  setPartStockLimits,
  type InventoryData,
  type InventoryPartRow,
} from "@/lib/actions/inventory";

/** Row-level stock status against its min/max thresholds (null = none set). */
export function stockStatus(
  total: number,
  min: number | null,
  max: number | null,
): "low" | "over" | null {
  if (min != null && total < min) return "low";
  if (max != null && total > max) return "over";
  return null;
}

function withTotal(row: InventoryPartRow): InventoryPartRow {
  const total = Object.values(row.qtyByLocation).reduce((a, b) => a + b, 0);
  return { ...row, total };
}

export function InventoryTable({
  data,
  canEdit,
  canEditLimits = false,
}: {
  data: InventoryData;
  canEdit: boolean;
  /** Min/max thresholds are policy — owner/co_owner only (parts_write RLS). */
  canEditLimits?: boolean;
}) {
  const { locations } = data;
  const [rows, setRows] = useState<InventoryPartRow[]>(data.parts);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [, startTransition] = useTransition();
  const [savingCell, setSavingCell] = useState<string | null>(null);

  // Last server-confirmed value per cell, so we only save real changes and can
  // revert cleanly on error.
  const savedRef = useRef<Map<string, number>>(
    new Map(
      data.parts.flatMap((p) =>
        locations.map((l) => [`${p.id}|${l.id}`, p.qtyByLocation[l.id] ?? 0] as const),
      ),
    ),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (lowOnly && stockStatus(r.total, r.min_stock_qty, r.max_stock_qty) !== "low") {
        return false;
      }
      if (!q) return true;
      return (
        r.part_number.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, lowOnly]);

  const lowCount = useMemo(
    () => rows.filter((r) => stockStatus(r.total, r.min_stock_qty, r.max_stock_qty) === "low").length,
    [rows],
  );

  const setLocalQty = (partId: string, locationId: string, qty: number) => {
    setRows((rs) =>
      rs.map((r) =>
        r.id === partId
          ? withTotal({ ...r, qtyByLocation: { ...r.qtyByLocation, [locationId]: qty } })
          : r,
      ),
    );
  };

  const commitCell = (partId: string, locationId: string, raw: string) => {
    const cellKey = `${partId}|${locationId}`;
    const prev = savedRef.current.get(cellKey) ?? 0;
    const qty = Math.max(0, Math.floor(Number(raw)));
    if (!Number.isFinite(qty)) {
      setLocalQty(partId, locationId, prev); // bad input -> restore
      return;
    }
    if (qty === prev) {
      setLocalQty(partId, locationId, qty); // normalize display, no save
      return;
    }
    setLocalQty(partId, locationId, qty);
    setSavingCell(cellKey);
    startTransition(async () => {
      const res = await setPartLocationStock({
        part_id: partId,
        location_id: locationId,
        qty,
      });
      setSavingCell(null);
      if (!res.ok) {
        toast.error(res.error);
        setLocalQty(partId, locationId, prev); // revert
        return;
      }
      savedRef.current.set(cellKey, qty);
      toast.success("Stock updated");
    });
  };

  // Last server-confirmed min/max per part, same idea as savedRef for counts.
  const savedLimitsRef = useRef<Map<string, number | null>>(
    new Map(
      data.parts.flatMap((p) => [
        [`${p.id}|min_stock_qty`, p.min_stock_qty] as const,
        [`${p.id}|max_stock_qty`, p.max_stock_qty] as const,
      ]),
    ),
  );

  const setLocalLimit = (
    partId: string,
    field: "min_stock_qty" | "max_stock_qty",
    value: number | null,
  ) => {
    setRows((rs) => rs.map((r) => (r.id === partId ? { ...r, [field]: value } : r)));
  };

  // Min/max threshold cell — empty clears the threshold (null).
  const commitLimit = (partId: string, field: "min_stock_qty" | "max_stock_qty", raw: string) => {
    const key = `${partId}|${field}`;
    const prev = savedLimitsRef.current.get(key) ?? null;
    const parsed = raw.trim() === "" ? null : Math.floor(Number(raw));
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      setLocalLimit(partId, field, prev); // bad input -> restore
      return;
    }
    if (parsed === prev) {
      setLocalLimit(partId, field, parsed);
      return;
    }
    const otherField = field === "min_stock_qty" ? "max_stock_qty" : "min_stock_qty";
    const otherSaved = savedLimitsRef.current.get(`${partId}|${otherField}`) ?? null;
    setLocalLimit(partId, field, parsed);
    startTransition(async () => {
      const res = await setPartStockLimits({
        part_id: partId,
        min_stock_qty: field === "min_stock_qty" ? parsed : otherSaved,
        max_stock_qty: field === "max_stock_qty" ? parsed : otherSaved,
      });
      if (!res.ok) {
        toast.error(res.error);
        setLocalLimit(partId, field, prev); // revert
        return;
      }
      savedLimitsRef.current.set(key, parsed);
      toast.success("Thresholds saved");
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
            placeholder="Search part #, brand, category…"
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
              <TableHead className="min-w-[220px]">Part</TableHead>
              <TableHead className="min-w-[120px]">Category</TableHead>
              {locations.map((l) => (
                <TableHead key={l.id} className="text-right min-w-[96px]">
                  {l.name}
                </TableHead>
              ))}
              <TableHead className="text-right min-w-[80px]">Total</TableHead>
              <TableHead className="text-right min-w-[72px]">Min</TableHead>
              <TableHead className="text-right min-w-[72px]">Max</TableHead>
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
                    ? "No parts in the catalogue yet."
                    : lowOnly && !query
                      ? "Nothing is below its minimum. 🎉"
                      : "No parts match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.part_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.brand}
                      {r.description ? ` · ${r.description}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.category}</TableCell>
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
                              inputMode="numeric"
                              value={qty}
                              disabled={savingCell === cellKey}
                              onChange={(e) =>
                                setLocalQty(r.id, l.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))
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
                      {stockStatus(r.total, r.min_stock_qty, r.max_stock_qty) === "low" && (
                        <Badge variant="destructive" className="text-[10px]">Low</Badge>
                      )}
                      {stockStatus(r.total, r.min_stock_qty, r.max_stock_qty) === "over" && (
                        <Badge className="bg-amber-500 text-[10px] hover:bg-amber-500">Over</Badge>
                      )}
                      {r.total}
                    </span>
                  </TableCell>
                  {(["min_stock_qty", "max_stock_qty"] as const).map((field) => (
                    <TableCell key={field} className="text-right">
                      {canEditLimits ? (
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={r[field] ?? ""}
                          placeholder="—"
                          onChange={(e) =>
                            setLocalLimit(
                              r.id,
                              field,
                              e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)),
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
