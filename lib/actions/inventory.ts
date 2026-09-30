"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import { uuidSchema } from "@/lib/schemas/common";
import type { StockLimit } from "@/lib/utils/stock-limits";

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
  /** location_id -> that shop's min / max. Only locations with one set. */
  limitsByLocation: Record<string, StockLimit>;
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
  /** False until migration 0151 creates the per-location threshold tables. */
  limits_supported: boolean;
}

/** "That table isn't there yet" — the thresholds ship in migration 0151. */
function isMissingRelation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "PGRST205" || code === "42P01";
}

/**
 * PostgREST caps any single response at 1000 rows, and part_location_stock is
 * past that (parts × locations). The old plain select silently dropped the
 * overflow, so hundreds of stock cells rendered as 0. Page through in chunks.
 */
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const CHUNK = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await buildQuery(from, from + CHUNK - 1);
    if (error) throw error;
    const rows = ((data ?? []) as T[]);
    all.push(...rows);
    if (rows.length < CHUNK) break;
  }
  return all;
}

export async function listInventory(): Promise<InventoryData> {
  const supabase = await createClient();

  type PartRow = {
    id: string;
    part_number: string;
    brand: string;
    description: string | null;
    part_categories: { name: string } | { name: string }[] | null;
  };
  type LimitRow = {
    part_id: string;
    location_id: string;
    min_qty: number | null;
    max_qty: number | null;
  };

  // 848 active parts and counting — page catalogue, stock and thresholds past
  // the 1000-row response cap.
  const [{ data: locs, error: locErr }, parts, stock, limits] = await Promise.all([
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
    fetchAllRows<PartRow>((from, to) =>
      supabase
        .from("parts")
        // `category` is a FK now (category_id -> part_categories); pull its name.
        .select("id, part_number, brand, description, part_categories:category_id(name)")
        .eq("active", true)
        .order("part_number")
        .range(from, to),
    ),
    fetchAllRows<{ part_id: string; location_id: string; qty: number }>((from, to) =>
      // Deterministic order across pages — without it rows could repeat or
      // vanish between chunks.
      supabase
        .from("part_location_stock")
        .select("part_id, location_id, qty")
        .order("part_id")
        .order("location_id")
        .range(from, to),
    ),
    // null = the table isn't there yet (deploy window before migration 0151).
    fetchAllRows<LimitRow>((from, to) =>
      supabase
        .from("part_location_limits")
        .select("part_id, location_id, min_qty, max_qty")
        .order("part_id")
        .order("location_id")
        .range(from, to),
    ).catch((e: unknown) => {
      if (!isMissingRelation(e)) throw e;
      console.warn("[listInventory] part_location_limits missing — has migration 0151 run?");
      return null;
    }),
  ]);
  if (locErr) throw locErr;

  const stockMap = new Map<string, number>();
  for (const s of stock) {
    stockMap.set(`${s.part_id}|${s.location_id}`, s.qty as number);
  }

  const limitsByPart = new Map<string, Record<string, StockLimit>>();
  for (const l of limits ?? []) {
    const slot = limitsByPart.get(l.part_id) ?? {};
    slot[l.location_id] = {
      min: l.min_qty != null ? Number(l.min_qty) : null,
      max: l.max_qty != null ? Number(l.max_qty) : null,
    };
    limitsByPart.set(l.part_id, slot);
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
      limitsByLocation: limitsByPart.get(p.id) ?? {},
    };
  });

  return { locations, parts: partsRows, limits_supported: limits != null };
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
  /** location_id -> that shop's min / max in litres. Only locations with one set. */
  limitsByLocation: Record<string, StockLimit>;
}

export interface OilInventoryData {
  locations: InventoryLocation[];
  oils: InventoryOilRow[];
  /** False until migration 0151 creates the per-location threshold tables. */
  limits_supported: boolean;
}

export async function listOilInventory(): Promise<OilInventoryData> {
  const supabase = await createClient();

  type OilRow = {
    id: string;
    code: string;
    name: string;
    is_engine_oil: boolean | null;
  };

  const [
    { data: locs, error: locErr },
    { data: oils, error: oilErr },
    { data: stock, error: stockErr },
    { data: limits, error: limitErr },
  ] = await Promise.all([
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
    supabase
      .from("oil_types")
      .select("id, code, name, is_engine_oil")
      .eq("active", true)
      .order("name"),
    supabase.from("oil_location_stock").select("oil_type_id, location_id, qty"),
    supabase
      .from("oil_location_limits")
      .select("oil_type_id, location_id, min_litres, max_litres"),
  ]);
  if (locErr) throw locErr;
  if (oilErr) throw oilErr;
  if (stockErr) throw stockErr;
  // Same deploy-window fallback as listInventory: no table, no thresholds.
  if (limitErr && !isMissingRelation(limitErr)) throw limitErr;

  const limitsByOil = new Map<string, Record<string, StockLimit>>();
  for (const l of limits ?? []) {
    const slot = limitsByOil.get(l.oil_type_id as string) ?? {};
    slot[l.location_id as string] = {
      min: l.min_litres != null ? Number(l.min_litres) : null,
      max: l.max_litres != null ? Number(l.max_litres) : null,
    };
    limitsByOil.set(l.oil_type_id as string, slot);
  }

  const stockMap = new Map<string, number>();
  for (const s of stock ?? []) {
    stockMap.set(`${s.oil_type_id}|${s.location_id}`, Number(s.qty));
  }

  const locations: InventoryLocation[] = (locs ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
  }));

  const oilRows: InventoryOilRow[] = ((oils ?? []) as OilRow[]).map((o) => {
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
      limitsByLocation: limitsByOil.get(o.id) ?? {},
    };
  });

  return { locations, oils: oilRows, limits_supported: !limitErr };
}

const SetOilStockInput = z.object({
  oil_type_id: uuidSchema,
  location_id: uuidSchema,
  // Litres — fractional allowed (e.g. 12.5 L).
  qty: z.coerce.number().min(0).max(1_000_000),
});

// ----------------------------------------------------------------------------
// Min / max thresholds, per location (0151) — policy, not counts, so
// owner/co_owner only (matches the part_location_limits / oil_location_limits
// RLS). NULL clears a threshold.
// ----------------------------------------------------------------------------
const limitValue = z
  .union([z.coerce.number().min(0).max(1_000_000), z.null()])
  .optional()
  .transform((v) => (v == null ? null : v));

const NEEDS_0151 =
  "Per-location min / max needs migration 0151_stock_limits_per_location.sql — apply it to the database, then try again.";

const SetPartLocationLimitsInput = z
  .object({ part_id: uuidSchema, location_id: uuidSchema, min: limitValue, max: limitValue })
  .refine((v) => v.min == null || v.max == null || v.min <= v.max, {
    message: "Minimum can't be above maximum",
  });

export const setPartLocationLimits = wrapAction({
  schema: SetPartLocationLimitsInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { error } = await supabase.from("part_location_limits").upsert(
      {
        part_id: input.part_id,
        location_id: input.location_id,
        min_qty: input.min == null ? null : Math.floor(input.min),
        max_qty: input.max == null ? null : Math.floor(input.max),
        updated_by: profile.id,
      },
      { onConflict: "part_id,location_id" },
    );
    if (error) {
      if (isMissingRelation(error)) throw new Error(NEEDS_0151);
      throw error;
    }
    revalidatePath("/inventory");
    return { ok: true };
  },
});

const SetOilLocationLimitsInput = z
  .object({ oil_type_id: uuidSchema, location_id: uuidSchema, min: limitValue, max: limitValue })
  .refine((v) => v.min == null || v.max == null || v.min <= v.max, {
    message: "Minimum can't be above maximum",
  });

export const setOilLocationLimits = wrapAction({
  schema: SetOilLocationLimitsInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { error } = await supabase.from("oil_location_limits").upsert(
      {
        oil_type_id: input.oil_type_id,
        location_id: input.location_id,
        min_litres: input.min,
        max_litres: input.max,
        updated_by: profile.id,
      },
      { onConflict: "oil_type_id,location_id" },
    );
    if (error) {
      if (isMissingRelation(error)) throw new Error(NEEDS_0151);
      throw error;
    }
    revalidatePath("/inventory");
    return { ok: true };
  },
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
