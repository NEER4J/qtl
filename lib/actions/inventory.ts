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
      .select("id, part_number, brand, category, description")
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
    return {
      id: p.id as string,
      part_number: p.part_number as string,
      brand: p.brand as string,
      category: p.category as string,
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
