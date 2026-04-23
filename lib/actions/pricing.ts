"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/require";
import type { EngineType, OilType, Part, ServiceCost, VolumeTier } from "@/lib/db/types";

// ============================================================================
// Read-only catalog queries — RLS already allows SELECT to all authenticated.
// Cost columns are stripped from the response for non-owners.
// ============================================================================

const CUSTOMER_VIEW_HIDDEN_KEYS: (keyof Part)[] = ["cost", "mhsw_fee"];

export async function listOilTypes(): Promise<OilType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oil_types")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as OilType[];
}

export async function listEngineTypes(): Promise<EngineType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engine_types")
    .select("*")
    .eq("active", true)
    .order("manufacturer")
    .order("model");
  if (error) throw error;
  return (data ?? []) as EngineType[];
}

export interface PriceListRow extends Part {
  service_cost_name: string | null;
}

export async function listParts(filter?: {
  category?: string;
  brand?: string;
  q?: string;
}): Promise<PriceListRow[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  let q = supabase
    .from("parts")
    .select("*, service_costs:service_cost_id(name)")
    .eq("active", true)
    .order("category")
    .order("brand")
    .order("part_number")
    .limit(2000);

  if (filter?.category) q = q.eq("category", filter.category);
  if (filter?.brand) q = q.eq("brand", filter.brand);
  if (filter?.q) {
    const term = `%${filter.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    q = q.or(`part_number.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const hideCost = profile.role !== "owner";
  type Row = Part & { service_costs: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const row: PriceListRow = {
      ...r,
      service_cost_name: r.service_costs?.name ?? null,
    };
    if (hideCost) {
      for (const k of CUSTOMER_VIEW_HIDDEN_KEYS) (row as unknown as Record<string, unknown>)[k] = 0;
    }
    return row;
  });
}

export async function listServiceCosts(): Promise<ServiceCost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_costs")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ServiceCost[];
}

export async function listVolumeTiers(): Promise<VolumeTier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("volume_tiers")
    .select("*")
    .order("oil_type_id")
    .order("min_litres");
  if (error) throw error;
  return (data ?? []) as VolumeTier[];
}

// ============================================================================
// Oil-change price grid — engines × oil types, using the SQL function
// oil_change_price(engine, oil, container).
// ============================================================================
export interface PriceGridCell {
  engine_id: string;
  oil_type_id: string;
  bulk: number | null;
  gallon: number | null;
}

export async function getOilChangeGrid(): Promise<{
  engines: EngineType[];
  oilTypes: OilType[];
  cells: Map<string, PriceGridCell>;
}> {
  const [engines, oilTypes] = await Promise.all([listEngineTypes(), listOilTypes()]);
  const supabase = await createClient();

  const cells = new Map<string, PriceGridCell>();

  // Materialise all prices in parallel. 45 engines × 7 oil types × 2 containers
  // ≈ 630 RPC calls — acceptable for a read-only catalog page.
  await Promise.all(
    engines.flatMap((e) =>
      oilTypes.map(async (o) => {
        const [bulk, gallon] = await Promise.all([
          supabase.rpc("oil_change_price", { p_engine_id: e.id, p_oil_type_id: o.id, p_container: "bulk" }),
          supabase.rpc("oil_change_price", { p_engine_id: e.id, p_oil_type_id: o.id, p_container: "gallon" }),
        ]);
        cells.set(`${e.id}|${o.id}`, {
          engine_id: e.id,
          oil_type_id: o.id,
          bulk: bulk.data != null ? Number(bulk.data) : null,
          gallon: gallon.data != null ? Number(gallon.data) : null,
        });
      }),
    ),
  );

  return { engines, oilTypes, cells };
}

// ============================================================================
// Statutory rate editor (Phase 4 — federal rate annual update)
// ============================================================================
import { wrapAction } from "@/lib/actions/_utils";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { StatutoryRate } from "@/lib/db/types";

const StatutoryRateInput = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  type: z.enum(["ei_employee", "ei_employer_multiplier", "cpp_employee", "cpp2_employee"]),
  rate: z.coerce.number().min(0).max(1),
  annual_max_insurable: z.coerce.number().min(0).optional().nullable(),
  annual_max_pensionable: z.coerce.number().min(0).optional().nullable(),
  annual_max_pensionable2: z.coerce.number().min(0).optional().nullable(),
  basic_exemption: z.coerce.number().min(0).optional().nullable(),
});

export const upsertStatutoryRate = wrapAction({
  schema: StatutoryRateInput,
  roles: ["owner"],
  handler: async (input): Promise<StatutoryRate> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("statutory_rates")
      .upsert(input, { onConflict: "year,type" })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/statutory-rates");
    return data as StatutoryRate;
  },
});

export async function listStatutoryRates(year?: number): Promise<StatutoryRate[]> {
  const supabase = await createClient();
  let q = supabase.from("statutory_rates").select("*").order("year", { ascending: false }).order("type");
  if (year) q = q.eq("year", year);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StatutoryRate[];
}
