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
import { cn } from "@/lib/utils";
import {
  setOilLocationStock,
  type InventoryOilRow,
  type OilInventoryData,
} from "@/lib/actions/inventory";

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
}: {
  data: OilInventoryData;
  canEdit: boolean;
}) {
  const { locations } = data;
  const [rows, setRows] = useState<InventoryOilRow[]>(data.oils);
  const [query, setQuery] = useState("");
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
    if (!q) return rows;
    return rows.filter(
      (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    );
  }, [rows, query]);

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
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search oil code or name…"
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border max-h-[calc(100vh-220px)] overflow-auto">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3 + locations.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0 ? "No oils in the catalogue yet." : "No oils match your search."}
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
                            className="h-8 w-20 ml-auto text-right tabular-nums"
                          />
                        ) : (
                          <span className="tabular-nums">{qty}</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className={cn("text-right font-medium tabular-nums")}>
                    {r.total}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
