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
