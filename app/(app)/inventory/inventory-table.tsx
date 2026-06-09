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
import { cn } from "@/lib/utils";
import {
  setPartLocationStock,
  type InventoryData,
  type InventoryPartRow,
} from "@/lib/actions/inventory";

function withTotal(row: InventoryPartRow): InventoryPartRow {
  const total = Object.values(row.qtyByLocation).reduce((a, b) => a + b, 0);
  return { ...row, total };
}

export function InventoryTable({
  data,
  canEdit,
}: {
  data: InventoryData;
  canEdit: boolean;
}) {
  const { locations } = data;
  const [rows, setRows] = useState<InventoryPartRow[]>(data.parts);
  const [query, setQuery] = useState("");
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
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.part_number.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search part #, brand, category…"
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border max-h-[calc(100vh-220px)] overflow-auto">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3 + locations.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0 ? "No parts in the catalogue yet." : "No parts match your search."}
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
