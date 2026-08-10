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
  /** Reorder point across ALL locations; null = not set. */
  min_stock_qty: number | null;
  /** Overstock ceiling across ALL locations; null = not set. */
  max_stock_qty: number | null;
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
    min_stock_qty: number | null;
    max_stock_qty: number | null;
    part_categories: { name: string } | { name: string }[] | null;
  };

  // 848 active parts and counting — page both catalogue and stock past the
  // 1000-row response cap. min/max columns arrive with migration 0126; fall
  // back without them for the deploy window where the build is live first
  // (42703 = undefined_column — same pattern as plates_text in customers).
  const fetchParts = async (includeLimits: boolean): Promise<PartRow[]> => {
    const cols = includeLimits
      ? "id, part_number, brand, description, min_stock_qty, max_stock_qty, part_categories:category_id(name)"
      : "id, part_number, brand, description, part_categories:category_id(name)";
    const rows = await fetchAllRows<PartRow>((from, to) =>
      supabase
        .from("parts")
        // `category` is a FK now (category_id -> part_categories); pull its name.
        .select(cols)
        .eq("active", true)
        .order("part_number")
        .range(from, to),
    );
    return includeLimits
      ? rows
      : rows.map((p) => ({ ...p, min_stock_qty: null, max_stock_qty: null }));
  };

  const [{ data: locs, error: locErr }, parts, stock] = await Promise.all([
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
    fetchParts(true).catch((e: { code?: string }) => {
      if (e?.code !== "42703") throw e;
      console.warn("[listInventory] min/max columns missing — has migration 0126 run?");
      return fetchParts(false);
    }),
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
  ]);
  if (locErr) throw locErr;

  const stockMap = new Map<string, number>();
  for (const s of stock) {
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
      min_stock_qty: p.min_stock_qty != null ? Number(p.min_stock_qty) : null,
      max_stock_qty: p.max_stock_qty != null ? Number(p.max_stock_qty) : null,
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
  /** Reorder point in litres across ALL locations; null = not set. */
  min_stock_litres: number | null;
  /** Overstock ceiling in litres across ALL locations; null = not set. */
  max_stock_litres: number | null;
}

export interface OilInventoryData {
  locations: InventoryLocation[];
  oils: InventoryOilRow[];
}

export async function listOilInventory(): Promise<OilInventoryData> {
  const supabase = await createClient();

  type OilRow = {
    id: string;
    code: string;
    name: string;
    is_engine_oil: boolean | null;
    min_stock_litres: number | null;
    max_stock_litres: number | null;
  };

  // min/max columns arrive with migration 0126 — same deploy-window fallback
  // as listInventory above.
  const fetchOils = async (includeLimits: boolean): Promise<OilRow[]> => {
    const cols = includeLimits
      ? "id, code, name, is_engine_oil, min_stock_litres, max_stock_litres"
      : "id, code, name, is_engine_oil";
    const { data, error } = await supabase
      .from("oil_types")
      .select(cols)
      .eq("active", true)
      .order("name");
    if (error) throw error;
    const rows = (data ?? []) as unknown as OilRow[];
    return includeLimits
      ? rows
      : rows.map((o) => ({ ...o, min_stock_litres: null, max_stock_litres: null }));
  };

  const [{ data: locs, error: locErr }, oils, { data: stock, error: stockErr }] =
    await Promise.all([
      supabase.from("locations").select("id, name").eq("active", true).order("name"),
      fetchOils(true).catch((e: { code?: string }) => {
        if (e?.code !== "42703") throw e;
        console.warn("[listOilInventory] min/max columns missing — has migration 0126 run?");
        return fetchOils(false);
      }),
      supabase.from("oil_location_stock").select("oil_type_id, location_id, qty"),
    ]);
  if (locErr) throw locErr;
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
      min_stock_litres: o.min_stock_litres != null ? Number(o.min_stock_litres) : null,
      max_stock_litres: o.max_stock_litres != null ? Number(o.max_stock_litres) : null,
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

// ----------------------------------------------------------------------------
// Min / max thresholds — policy, not counts, so owner/co_owner only (matches
// the parts_write / oil_types_write RLS). NULL clears a threshold.
// ----------------------------------------------------------------------------
const limitValue = z
  .union([z.coerce.number().min(0).max(1_000_000), z.null()])
  .optional()
  .transform((v) => (v == null ? null : v));

const SetPartStockLimitsInput = z
  .object({ part_id: uuidSchema, min_stock_qty: limitValue, max_stock_qty: limitValue })
  .refine(
    (v) => v.min_stock_qty == null || v.max_stock_qty == null || v.min_stock_qty <= v.max_stock_qty,
    { message: "Minimum can't be above maximum" },
  );

export const setPartStockLimits = wrapAction({
  schema: SetPartStockLimitsInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("parts")
      .update({
        min_stock_qty: input.min_stock_qty == null ? null : Math.floor(input.min_stock_qty),
        max_stock_qty: input.max_stock_qty == null ? null : Math.floor(input.max_stock_qty),
      })
      .eq("id", input.part_id);
    if (error) throw error;
    revalidatePath("/inventory");
    return { ok: true };
  },
});

const SetOilStockLimitsInput = z
  .object({ oil_type_id: uuidSchema, min_stock_litres: limitValue, max_stock_litres: limitValue })
  .refine(
    (v) =>
      v.min_stock_litres == null || v.max_stock_litres == null || v.min_stock_litres <= v.max_stock_litres,
    { message: "Minimum can't be above maximum" },
  );

export const setOilStockLimits = wrapAction({
  schema: SetOilStockLimitsInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("oil_types")
      .update({
        min_stock_litres: input.min_stock_litres,
        max_stock_litres: input.max_stock_litres,
      })
      .eq("id", input.oil_type_id);
    if (error) throw error;
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
