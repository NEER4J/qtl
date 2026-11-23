"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStockTransfer } from "@/lib/actions/stock-transfers";

export interface TransferItemOption {
  key: string; // "part:<id>" | "oil:<id>"
  label: string;
  /** location_id -> on hand there */
  qtyByLocation: Record<string, number>;
  unit: string; // "" for parts, "L" for oil
}

const MAX_RESULTS = 30;

export function TransferForm({
  locations,
  fromLocations,
  items,
  today,
}: {
  locations: { id: string; name: string }[];
  /** Locations this person may send from. */
  fromLocations: { id: string; name: string }[];
  items: TransferItemOption[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fromId, setFromId] = useState(fromLocations[0]?.id ?? "");
  const [toId, setToId] = useState(locations.find((l) => l.id !== fromLocations[0]?.id)?.id ?? "");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<TransferItemOption | null>(null);
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const out: TransferItemOption[] = [];
    for (const it of items) {
      const hay = it.label.toLowerCase();
      if (words.every((w) => hay.includes(w))) out.push(it);
      if (out.length === MAX_RESULTS) break;
    }
    return out;
  }, [items, q]);

  const onHandFrom = picked ? (picked.qtyByLocation[fromId] ?? 0) : null;
  const onHandTo = picked ? (picked.qtyByLocation[toId] ?? 0) : null;

  const submit = () => {
    if (!picked) {
      toast.error("Pick a part or an oil.");
      return;
    }
    const [kind, id] = picked.key.split(":");
    startTransition(async () => {
      const res = await createStockTransfer({
        transfer_date: date,
        from_location_id: fromId,
        to_location_id: toId,
        part_id: kind === "part" ? id : null,
        oil_type_id: kind === "oil" ? id : null,
        quantity: qty,
        notes,
      });
      if (!res.ok) {
        const field = res.fieldErrors ? Object.values(res.fieldErrors)[0]?.[0] : null;
        toast.error(field ?? res.error);
        return;
      }
      toast.success(`Moved ${qty}${picked.unit ? ` ${picked.unit}` : ""} of ${picked.label}`);
      setPicked(null);
      setQ("");
      setQty("1");
      setNotes("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <select
            id="from"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            {fromLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <ArrowRight className="mx-auto hidden size-4 text-muted-foreground sm:block sm:mb-2.5" />
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <select
            id="to"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id} disabled={l.id === fromId}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="item">Part or oil</Label>
        {picked ? (
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="font-medium">{picked.label}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
              Change
            </Button>
          </div>
        ) : (
          <>
            <Input
              id="item"
              placeholder="Search part # or oil code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
            {results.length > 0 && (
              <ul className="max-h-64 overflow-auto rounded-md border text-sm">
                {results.map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-muted"
                      onClick={() => setPicked(it)}
                    >
                      <span className="truncate">{it.label}</span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                        {Number((it.qtyByLocation[fromId] ?? 0).toFixed(2))}
                        {it.unit ? ` ${it.unit}` : ""} at sending location
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {picked && (
          <p className="text-xs text-muted-foreground">
            On hand now: {Number((onHandFrom ?? 0).toFixed(2))}
            {picked.unit ? ` ${picked.unit}` : ""} at {fromLocations.find((l) => l.id === fromId)?.name ?? "—"},{" "}
            {Number((onHandTo ?? 0).toFixed(2))}
            {picked.unit ? ` ${picked.unit}` : ""} at {locations.find((l) => l.id === toId)?.name ?? "—"}.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="qty">Quantity{picked?.unit ? ` (${picked.unit})` : ""}</Label>
          <Input
            id="qty"
            type="number"
            min="0"
            step={picked?.unit ? "any" : "1"}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <Button type="button" onClick={submit} disabled={pending || !picked || !fromId || !toId || fromId === toId}>
        {pending ? "Moving…" : "Transfer"}
      </Button>
    </div>
  );
}
