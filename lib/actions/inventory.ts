"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import { uuidSchema } from "@/lib/schemas/common";

// ----------------------------------------------------------------------------
// Inventory = per-location stock count for each catalogue part.
// Anyone signed in can read counts; only owner / co_owner / manager can edit
// (enforced here AND by RLS in 0077_part_location_stock.sql).
// ----------------------------------------------------------------------------
export interface InventoryLocation {
  id: string;
  name: string;
}

export interface InventoryPartRow {
  id: string;
  part_number: string;
  brand: string;
  category: string;
  description: string | null;
  /** location_id -> on-hand qty (0 when no row exists). */
  qtyByLocation: Record<string, number>;
  total: number;
}

// ----------------------------------------------------------------------------
// Stock-sufficiency check for sales — "don't let the sale go through if the
// item isn't in stock" (client 2026-07-23). Shared by createSalesJob /
// updateSalesJob in lib/actions/sales.ts, which run this BEFORE writing
// anything so a shortfall never leaves a half-created job behind.
// ----------------------------------------------------------------------------
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

// On-hand stock summary for a single part across all locations. Used to warn
// before deactivating a part that still has inventory.
export async function getPartStockSummary(
  partId: string,
): Promise<{ total: number; locations: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("part_location_stock")
    .select("qty")
    .eq("part_id", partId)
    .gt("qty", 0);
  if (error) throw error;
  const rows = (data ?? []) as { qty: number }[];
  const total = rows.reduce((s, r) => s + Number(r.qty), 0);
  return { total, locations: rows.length };
}

export interface InventoryData {
  locations: InventoryLocation[];
  parts: InventoryPartRow[];
}

export async function listInventory(): Promise<InventoryData> {
  const supabase = await createClient();

  const [
    { data: locs, error: locErr },
    { data: parts, error: partErr },
    { data: stock, error: stockErr },
  ] = await Promise.all([
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
    supabase
      .from("parts")
      // `category` is a FK now (category_id -> part_categories); pull its name.
      .select("id, part_number, brand, description, part_categories:category_id(name)")
      .eq("active", true)
      .order("part_number"),
    supabase.from("part_location_stock").select("part_id, location_id, qty"),
  ]);
  if (locErr) throw locErr;
  if (partErr) throw partErr;
  if (stockErr) throw stockErr;

  const stockMap = new Map<string, number>();
  for (const s of stock ?? []) {
    stockMap.set(`${s.part_id}|${s.location_id}`, s.qty as number);
  }

  const locations: InventoryLocation[] = (locs ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
  }));

  const partsRows: InventoryPartRow[] = (parts ?? []).map((p) => {
    const qtyByLocation: Record<string, number> = {};
    let total = 0;
    for (const loc of locations) {
      const q = stockMap.get(`${p.id}|${loc.id}`) ?? 0;
      qtyByLocation[loc.id] = q;
      total += q;
    }
    // The category relation comes back as an object (or array, depending on
    // the join) — normalise to its name.
    const cat = (p as { part_categories?: { name: string } | { name: string }[] | null })
      .part_categories;
    const categoryName = Array.isArray(cat) ? (cat[0]?.name ?? "") : (cat?.name ?? "");
    return {
      id: p.id as string,
      part_number: p.part_number as string,
      brand: p.brand as string,
      category: categoryName,
      description: (p.description as string | null) ?? null,
      qtyByLocation,
      total,
    };
  });

  return { locations, parts: partsRows };
}

const SetStockInput = z.object({
  part_id: uuidSchema,
  location_id: uuidSchema,
  qty: z.coerce.number().int().min(0).max(1_000_000),
});

export const setPartLocationStock = wrapAction({
  schema: SetStockInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<{ qty: number }> => {
    const supabase = await createClient();
    const { error } = await supabase.from("part_location_stock").upsert(
      {
        part_id: input.part_id,
        location_id: input.location_id,
        qty: input.qty,
        updated_by: profile.id,
      },
      { onConflict: "part_id,location_id" },
    );
    if (error) throw error;
    revalidatePath("/inventory");
    return { qty: input.qty };
  },
});

// ----------------------------------------------------------------------------
// Oils inventory — per-location on-hand litres for each oil grade. Mirrors the
// parts inventory above; qty is fractional (litres). Same view/edit gating.
// ----------------------------------------------------------------------------
export interface InventoryOilRow {
  id: string;
  code: string;
  name: string;
  is_engine_oil: boolean;
  /** location_id -> on-hand litres (0 when no row exists). */
  qtyByLocation: Record<string, number>;
  total: number;
}

export interface OilInventoryData {
  locations: InventoryLocation[];
  oils: InventoryOilRow[];
}

export async function listOilInventory(): Promise<OilInventoryData> {
  const supabase = await createClient();

  const [
    { data: locs, error: locErr },
    { data: oils, error: oilErr },
    { data: stock, error: stockErr },
  ] = await Promise.all([
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
    supabase
      .from("oil_types")
      .select("id, code, name, is_engine_oil")
      .eq("active", true)
      .order("name"),
    supabase.from("oil_location_stock").select("oil_type_id, location_id, qty"),
  ]);
  if (locErr) throw locErr;
  if (oilErr) throw oilErr;
  if (stockErr) throw stockErr;

  const stockMap = new Map<string, number>();
  for (const s of stock ?? []) {
    stockMap.set(`${s.oil_type_id}|${s.location_id}`, Number(s.qty));
  }

  const locations: InventoryLocation[] = (locs ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
  }));

  const oilRows: InventoryOilRow[] = (oils ?? []).map((o) => {
    const qtyByLocation: Record<string, number> = {};
    let total = 0;
    for (const loc of locations) {
      const q = stockMap.get(`${o.id}|${loc.id}`) ?? 0;
      qtyByLocation[loc.id] = q;
      total += q;
    }
    return {
      id: o.id as string,
      code: o.code as string,
      name: o.name as string,
      is_engine_oil: (o.is_engine_oil as boolean) ?? false,
      qtyByLocation,
      total,
    };
  });

  return { locations, oils: oilRows };
}

const SetOilStockInput = z.object({
  oil_type_id: uuidSchema,
  location_id: uuidSchema,
  // Litres — fractional allowed (e.g. 12.5 L).
  qty: z.coerce.number().min(0).max(1_000_000),
});

export const setOilLocationStock = wrapAction({
  schema: SetOilStockInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<{ qty: number }> => {
    const supabase = await createClient();
    const { error } = await supabase.from("oil_location_stock").upsert(
      {
        oil_type_id: input.oil_type_id,
        location_id: input.location_id,
        qty: input.qty,
        updated_by: profile.id,
      },
      { onConflict: "oil_type_id,location_id" },
    );
    if (error) throw error;
    revalidatePath("/inventory");
    return { qty: input.qty };
  },
});
