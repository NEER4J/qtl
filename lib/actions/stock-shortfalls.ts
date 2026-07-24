// Stock-sufficiency helpers for sales — "don't let the sale go through if the
// item isn't in stock" (client 2026-07-23). Shared by createSalesJob /
// updateSalesJob in lib/actions/sales.ts, which run this BEFORE writing
// anything so a shortfall never leaves a half-created job behind.
//
// NOTE: this is a plain server-side module, NOT a "use server" file. A Server
// Actions file may only export async functions, and these are internal
// helpers (a sync formatter + a client-taking query), not client-callable
// actions — so they live here and are imported by inventory.ts / sales.ts.
import type { createClient } from "@/lib/supabase/server";

export interface StockConsumingLine {
  part_id?: string | null;
  oil_type_id?: string | null;
  quantity: number;
  unit_price: number;
  /** Customer-supplied lines never draw on the shop's own stock. */
  is_customer_supplied?: boolean;
}

export interface StockShortfall {
  kind: "part" | "oil";
  id: string;
  label: string;
  /** Net additional quantity this save would need beyond what's on hand. */
  required: number;
  available: number;
  unit: string;
}

/**
 * Net "how much MORE of this part/oil would this save consume" per catalogue
 * item. A return/credit line (unit_price < 0) gives stock back, so it's
 * netted as negative consumption rather than ignored.
 */
function netConsumptionByKey(lines: StockConsumingLine[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    if (line.is_customer_supplied) continue;
    const key = line.part_id
      ? `part:${line.part_id}`
      : line.oil_type_id
        ? `oil:${line.oil_type_id}`
        : null;
    if (!key) continue;
    const qty = Number(line.quantity) || 0;
    const signed = Number(line.unit_price) < 0 ? -qty : qty;
    map.set(key, (map.get(key) ?? 0) + signed);
  }
  return map;
}

/**
 * Compares the NET change in stock requirement (new lines minus old lines —
 * so editing an existing job doesn't double-count what it's already
 * reserved) against on-hand qty at `locationId`. Returns one entry per
 * catalogue item that would go short; empty array means the save is safe to
 * proceed.
 */
export async function findStockShortfalls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locationId: string,
  newLines: StockConsumingLine[],
  oldLines: StockConsumingLine[] = [],
): Promise<StockShortfall[]> {
  const newMap = netConsumptionByKey(newLines);
  const oldMap = netConsumptionByKey(oldLines);

  const netNeeded = new Map<string, number>();
  for (const [key, qty] of newMap) {
    const net = qty - (oldMap.get(key) ?? 0);
    if (net > 0.0001) netNeeded.set(key, net);
  }
  if (netNeeded.size === 0) return [];

  const partIds = [...netNeeded.keys()]
    .filter((k) => k.startsWith("part:"))
    .map((k) => k.slice(5));
  const oilIds = [...netNeeded.keys()]
    .filter((k) => k.startsWith("oil:"))
    .map((k) => k.slice(4));

  const [
    { data: partStock, error: partStockErr },
    { data: partNames, error: partNamesErr },
    { data: oilStock, error: oilStockErr },
    { data: oilNames, error: oilNamesErr },
  ] = await Promise.all([
    partIds.length
      ? supabase
          .from("part_location_stock")
          .select("part_id, qty")
          .eq("location_id", locationId)
          .in("part_id", partIds)
      : Promise.resolve({ data: [], error: null }),
    partIds.length
      ? supabase.from("parts").select("id, brand, part_number").in("id", partIds)
      : Promise.resolve({ data: [], error: null }),
    oilIds.length
      ? supabase
          .from("oil_location_stock")
          .select("oil_type_id, qty")
          .eq("location_id", locationId)
          .in("oil_type_id", oilIds)
      : Promise.resolve({ data: [], error: null }),
    oilIds.length
      ? supabase.from("oil_types").select("id, code, name").in("id", oilIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (partStockErr) throw partStockErr;
  if (partNamesErr) throw partNamesErr;
  if (oilStockErr) throw oilStockErr;
  if (oilNamesErr) throw oilNamesErr;

  const partStockMap = new Map(
    (partStock ?? []).map((r) => [r.part_id as string, Number(r.qty)]),
  );
  const partLabelMap = new Map(
    (partNames ?? []).map((p) => [p.id as string, `${p.brand} ${p.part_number}`]),
  );
  const oilStockMap = new Map(
    (oilStock ?? []).map((r) => [r.oil_type_id as string, Number(r.qty)]),
  );
  const oilLabelMap = new Map(
    (oilNames ?? []).map((o) => [o.id as string, `${o.code} — ${o.name}`]),
  );

  const shortfalls: StockShortfall[] = [];
  for (const [key, required] of netNeeded) {
    const isPart = key.startsWith("part:");
    const id = key.slice(isPart ? 5 : 4);
    const available = isPart ? (partStockMap.get(id) ?? 0) : (oilStockMap.get(id) ?? 0);
    if (required > available + 0.0001) {
      shortfalls.push({
        kind: isPart ? "part" : "oil",
        id,
        label: (isPart ? partLabelMap.get(id) : oilLabelMap.get(id)) ?? "Unknown item",
        required,
        available,
        unit: isPart ? "" : "L",
      });
    }
  }
  return shortfalls;
}

export function formatStockShortfalls(shortfalls: StockShortfall[]): string {
  const lines = shortfalls.map(
    (s) =>
      `${s.label}: need ${s.required}${s.unit}, have ${s.available}${s.unit}`,
  );
  return `Not enough stock to complete this sale — ${lines.join("; ")}.`;
}
