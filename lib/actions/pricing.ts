"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/require";
import { wrapAction } from "@/lib/actions/_utils";
import type {
  EngineFilter,
  EngineType,
  OilType,
  Part,
  PartBrand,
  PartCategory,
  ServiceCost,
  StatutoryRate,
  VolumeTier,
} from "@/lib/db/types";
import {
  CreateEngineTypeInput,
  CreateOilTypeInput,
  CreatePartBrandInput,
  CreatePartCategoryInput,
  CreatePartInput,
  CreateServiceCostInput,
  CreateVolumeTierInput,
  DeleteEngineFilterInput,
  DeleteVolumeTierInput,
  ToggleActiveInput,
  UpdateEngineTypeInput,
  UpdateOilTypeInput,
  UpdatePartBrandInput,
  UpdatePartCategoryInput,
  UpdatePartInput,
  UpdateServiceCostInput,
  UpdateVolumeTierInput,
  UpsertEngineFilterInput,
} from "@/lib/schemas/pricing";
import { normalizePartPricing } from "@/lib/utils/part-pricing";

// ============================================================================
// Read-only catalog queries — RLS already allows SELECT to all authenticated.
// Cost columns are stripped from the response for non-owners.
// ============================================================================

const CUSTOMER_VIEW_HIDDEN_KEYS: (keyof Part)[] = ["cost", "mhsw_fee", "margin_value"];

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
      ...normalizePartPricing(r),
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
const LITRES_PER_IMPERIAL_GALLON = 4.54609;

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
  const supabase = await createClient();

  // Mirrors public.oil_change_price(): one batched read per table instead of
  // engines×oil_types×containers RPCs (the prior approach overwhelmed the
  // request pipeline and surfaced as RangeError on this page).
  const [enginesRes, oilTypesRes, filtersRes, tiersRes] = await Promise.all([
    supabase
      .from("engine_types")
      .select("*")
      .eq("active", true)
      .order("manufacturer")
      .order("model"),
    supabase
      .from("oil_types")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("engine_filters")
      .select("engine_type_id, quantity, parts:part_id(cost, mhsw_fee, service_costs:service_cost_id(cost))"),
    supabase.from("volume_tiers").select("oil_type_id, min_litres, premium"),
  ]);

  if (enginesRes.error) throw enginesRes.error;
  if (oilTypesRes.error) throw oilTypesRes.error;
  if (filtersRes.error) throw filtersRes.error;
  if (tiersRes.error) throw tiersRes.error;

  const engines = (enginesRes.data ?? []) as EngineType[];
  const oilTypes = (oilTypesRes.data ?? []) as OilType[];

  type FilterRow = {
    engine_type_id: string;
    quantity: number;
    parts: {
      cost: number;
      mhsw_fee: number;
      service_costs: { cost: number } | null;
    } | null;
  };
  const enginePartCost = new Map<string, number>();
  const engineServiceCost = new Map<string, number>();
  for (const f of (filtersRes.data ?? []) as unknown as FilterRow[]) {
    if (!f.parts) continue;
    const qty = Number(f.quantity) || 0;
    const partCost = (Number(f.parts.cost) + Number(f.parts.mhsw_fee)) * qty;
    const svcCost = Number(f.parts.service_costs?.cost ?? 0) * qty;
    enginePartCost.set(f.engine_type_id, (enginePartCost.get(f.engine_type_id) ?? 0) + partCost);
    engineServiceCost.set(f.engine_type_id, (engineServiceCost.get(f.engine_type_id) ?? 0) + svcCost);
  }

  type TierRow = { oil_type_id: string; min_litres: number; premium: number };
  const tiersByOil = new Map<string, TierRow[]>();
  for (const t of (tiersRes.data ?? []) as TierRow[]) {
    const arr = tiersByOil.get(t.oil_type_id) ?? [];
    arr.push(t);
    tiersByOil.set(t.oil_type_id, arr);
  }

  const tierPremiumFor = (oilId: string, capacity: number): number => {
    const tiers = tiersByOil.get(oilId);
    if (!tiers || tiers.length === 0) return 0;
    let best: TierRow | null = null;
    for (const t of tiers) {
      if (Number(t.min_litres) <= capacity && (!best || Number(t.min_litres) > Number(best.min_litres))) {
        best = t;
      }
    }
    return best ? Number(best.premium) || 0 : 0;
  };

  const round99 = (sell: number): number => Math.ceil(sell) - 0.01;

  const cells = new Map<string, PriceGridCell>();
  for (const e of engines) {
    const capacity = Number(e.oil_capacity_litres);
    const filterCost = enginePartCost.get(e.id) ?? 0;
    const serviceCost = engineServiceCost.get(e.id) ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) {
      for (const o of oilTypes) {
        cells.set(`${e.id}|${o.id}`, { engine_id: e.id, oil_type_id: o.id, bulk: null, gallon: null });
      }
      continue;
    }
    for (const o of oilTypes) {
      const tier = tierPremiumFor(o.id, capacity);
      const bulkRate = Number(o.bulk_cost_per_litre);
      // gallon_cost_per_litre stores price per Imperial gallon (Canada);
      // convert to per-litre before multiplying by capacity.
      const gallonRate = Number(o.gallon_cost_per_litre) / LITRES_PER_IMPERIAL_GALLON;
      const bulk = Number.isFinite(bulkRate)
        ? round99(bulkRate * capacity + filterCost + serviceCost + tier)
        : null;
      const gallon = Number.isFinite(gallonRate)
        ? round99(gallonRate * capacity + filterCost + serviceCost + tier)
        : null;
      cells.set(`${e.id}|${o.id}`, { engine_id: e.id, oil_type_id: o.id, bulk, gallon });
    }
  }

  return { engines, oilTypes, cells };
}

// ============================================================================
// Statutory rate editor (Phase 4 — federal rate annual update)
// ============================================================================

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

// ============================================================================
// Admin read helpers — unlike listOilTypes/listEngineTypes/listParts above,
// these return BOTH active and inactive rows so the admin tables can show
// deactivated entries with a toggle to re-activate them.
// ============================================================================

export async function listAllOilTypes(): Promise<OilType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oil_types")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as OilType[];
}

export async function listAllEngineTypes(): Promise<EngineType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engine_types")
    .select("*")
    .order("manufacturer")
    .order("model");
  if (error) throw error;
  return (data ?? []) as EngineType[];
}

export async function listAllServiceCosts(): Promise<ServiceCost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_costs")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ServiceCost[];
}

export interface AdminPartRow extends Part {
  service_cost_name: string | null;
}

export async function listAllParts(filter?: {
  category?: string;
  brand?: string;
  q?: string;
}): Promise<AdminPartRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("parts")
    .select("*, service_costs:service_cost_id(name)")
    .order("category")
    .order("brand")
    .order("part_number")
    .limit(2000);

  if (filter?.category) query = query.eq("category", filter.category);
  if (filter?.brand) query = query.eq("brand", filter.brand);
  if (filter?.q) {
    const term = `%${filter.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(`part_number.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  type Row = Part & { service_costs: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...normalizePartPricing(r),
    service_cost_name: r.service_costs?.name ?? null,
  }));
}

/**
 * Active category/brand names, for dropdown suggestions in the Part form.
 * Read from the managed `part_categories` / `part_brands` tables.
 */
export async function listPartCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("part_categories")
    .select("name")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

export async function listPartBrands(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("part_brands")
    .select("name")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

/**
 * Full rows (active + inactive) for the admin pages.
 */
export async function listAllPartCategories(): Promise<PartCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("part_categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as PartCategory[];
}

export async function listAllPartBrands(): Promise<PartBrand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("part_brands")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as PartBrand[];
}

export async function listPartsForPicker(q?: string): Promise<Part[]> {
  const supabase = await createClient();
  let query = supabase
    .from("parts")
    .select("*")
    .eq("active", true)
    .order("brand")
    .order("part_number")
    .limit(50);
  if (q && q.trim()) {
    const term = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(`part_number.ilike.${term},description.ilike.${term},brand.ilike.${term}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Part[];
}

export interface EngineFilterRow extends EngineFilter {
  part: Part;
}

export interface EngineTypeDetail {
  engine: EngineType;
  filters: EngineFilterRow[];
}

export async function getEngineTypeDetail(id: string): Promise<EngineTypeDetail | null> {
  const supabase = await createClient();
  const { data: engine, error: eErr } = await supabase
    .from("engine_types")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (eErr) throw eErr;
  if (!engine) return null;

  const { data: filters, error: fErr } = await supabase
    .from("engine_filters")
    .select("*, part:part_id(*)")
    .eq("engine_type_id", id)
    .order("id");
  if (fErr) throw fErr;

  type Row = EngineFilter & { part: Part };
  const rows = ((filters ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    part: r.part,
  }));

  return { engine: engine as EngineType, filters: rows };
}

// ============================================================================
// Shared revalidate helper — every pricing write can change the oil-change
// grid, the filter list, the staff catalogue page, and the admin pages.
// ============================================================================
function revalidatePricing(entity?: string) {
  revalidatePath("/pricing");
  revalidatePath("/pricing/filters");
  revalidatePath("/pricing/oil-grid");
  revalidatePath("/settings/pricing");
  if (entity) revalidatePath(`/settings/pricing/${entity}`);
}

// ============================================================================
// oil_types — create / update / toggle active
// ============================================================================

export const createOilType = wrapAction({
  schema: CreateOilTypeInput,
  roles: ["owner"],
  handler: async (input): Promise<OilType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("oil_types")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("oil-types");
    return data as OilType;
  },
});

export const updateOilType = wrapAction({
  schema: UpdateOilTypeInput,
  roles: ["owner"],
  handler: async ({ id, ...fields }): Promise<OilType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("oil_types")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("oil-types");
    return data as OilType;
  },
});

export const toggleOilTypeActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner"],
  handler: async (input): Promise<OilType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("oil_types")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("oil-types");
    return data as OilType;
  },
});

// ============================================================================
// engine_types — create / update / toggle active
// ============================================================================

export const createEngineType = wrapAction({
  schema: CreateEngineTypeInput,
  roles: ["owner"],
  handler: async (input): Promise<EngineType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("engine_types")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("engine-types");
    return data as EngineType;
  },
});

export const updateEngineType = wrapAction({
  schema: UpdateEngineTypeInput,
  roles: ["owner"],
  handler: async ({ id, ...fields }): Promise<EngineType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("engine_types")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("engine-types");
    return data as EngineType;
  },
});

export const toggleEngineTypeActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner"],
  handler: async (input): Promise<EngineType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("engine_types")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("engine-types");
    return data as EngineType;
  },
});

// ============================================================================
// parts — create / update / toggle active
// ============================================================================

/**
 * Side-effect: if the part references a category/brand name that isn't yet in
 * the reference tables, upsert it so the dropdown picks it up next time.
 * Runs after the main insert/update so a blocked write doesn't leave orphan
 * reference rows.
 */
async function syncCategoryBrandRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  category: string,
  brand: string,
) {
  const cat = category.trim();
  const br = brand.trim();
  if (cat) {
    const { error } = await supabase
      .from("part_categories")
      .upsert({ name: cat }, { onConflict: "name", ignoreDuplicates: true });
    if (error) console.error("[syncCategoryBrandRefs] category", error);
  }
  if (br) {
    const { error } = await supabase
      .from("part_brands")
      .upsert({ name: br }, { onConflict: "name", ignoreDuplicates: true });
    if (error) console.error("[syncCategoryBrandRefs] brand", error);
  }
}

export const createPart = wrapAction({
  schema: CreatePartInput,
  roles: ["owner"],
  handler: async (input): Promise<Part> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("parts")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    await syncCategoryBrandRefs(supabase, input.category, input.brand);
    revalidatePricing("parts");
    revalidatePath("/settings/pricing/categories");
    revalidatePath("/settings/pricing/brands");
    return data as Part;
  },
});

export const updatePart = wrapAction({
  schema: UpdatePartInput,
  roles: ["owner"],
  handler: async ({ id, ...fields }): Promise<Part> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("parts")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await syncCategoryBrandRefs(supabase, fields.category, fields.brand);
    revalidatePricing("parts");
    revalidatePath("/settings/pricing/categories");
    revalidatePath("/settings/pricing/brands");
    return data as Part;
  },
});

export const togglePartActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner"],
  handler: async (input): Promise<Part> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("parts")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("parts");
    return data as Part;
  },
});

// ============================================================================
// service_costs — create / update / toggle active
// ============================================================================

export const createServiceCost = wrapAction({
  schema: CreateServiceCostInput,
  roles: ["owner"],
  handler: async (input): Promise<ServiceCost> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_costs")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("service-costs");
    return data as ServiceCost;
  },
});

export const updateServiceCost = wrapAction({
  schema: UpdateServiceCostInput,
  roles: ["owner"],
  handler: async ({ id, ...fields }): Promise<ServiceCost> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_costs")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("service-costs");
    return data as ServiceCost;
  },
});

export const toggleServiceCostActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner"],
  handler: async (input): Promise<ServiceCost> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_costs")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("service-costs");
    return data as ServiceCost;
  },
});

// ============================================================================
// volume_tiers — create / update / delete (no active flag on this table;
// rows are cheap and FK-owned by oil_types via cascade).
// ============================================================================

export const createVolumeTier = wrapAction({
  schema: CreateVolumeTierInput,
  roles: ["owner"],
  handler: async (input): Promise<VolumeTier> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("volume_tiers")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("volume-tiers");
    return data as VolumeTier;
  },
});

export const updateVolumeTier = wrapAction({
  schema: UpdateVolumeTierInput,
  roles: ["owner"],
  handler: async ({ id, ...fields }): Promise<VolumeTier> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("volume_tiers")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("volume-tiers");
    return data as VolumeTier;
  },
});

export const deleteVolumeTier = wrapAction({
  schema: DeleteVolumeTierInput,
  roles: ["owner"],
  handler: async (input): Promise<{ id: string }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("volume_tiers")
      .delete()
      .eq("id", input.id);
    if (error) throw error;
    revalidatePricing("volume-tiers");
    return { id: input.id };
  },
});

// ============================================================================
// engine_filters — upsert (by engine + part unique) and delete
// ============================================================================

export const upsertEngineFilter = wrapAction({
  schema: UpsertEngineFilterInput,
  roles: ["owner"],
  handler: async (input): Promise<EngineFilter> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("engine_filters")
      .upsert(input, { onConflict: "engine_type_id,part_id" })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("engine-types");
    return data as EngineFilter;
  },
});

export const deleteEngineFilter = wrapAction({
  schema: DeleteEngineFilterInput,
  roles: ["owner"],
  handler: async (input): Promise<{ id: string }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("engine_filters")
      .delete()
      .eq("id", input.id);
    if (error) throw error;
    revalidatePricing("engine-types");
    return { id: input.id };
  },
});

// Search action used by the engine-detail part picker.
export const searchPartsForEngine = wrapAction({
  schema: z.object({ q: z.string().trim().max(100).optional() }),
  roles: ["owner"],
  handler: async (input): Promise<Part[]> => {
    return listPartsForPicker(input.q);
  },
});

// ============================================================================
// part_categories — create / update (with cascade rename on parts) / toggle
// ============================================================================

export const createPartCategory = wrapAction({
  schema: CreatePartCategoryInput,
  roles: ["owner"],
  handler: async (input): Promise<PartCategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("part_categories")
      .insert({ ...input, name: input.name.trim() })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("categories");
    revalidatePath("/settings/pricing/parts");
    return data as PartCategory;
  },
});

export const updatePartCategory = wrapAction({
  schema: UpdatePartCategoryInput,
  roles: ["owner"],
  handler: async ({ id, ...fields }): Promise<PartCategory> => {
    const supabase = await createClient();
    // Fetch the existing name so we can cascade the rename to parts.category.
    const { data: prev, error: prevErr } = await supabase
      .from("part_categories")
      .select("name")
      .eq("id", id)
      .single();
    if (prevErr) throw prevErr;

    const nextName = fields.name.trim();
    const { data, error } = await supabase
      .from("part_categories")
      .update({ ...fields, name: nextName })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    if (prev && prev.name !== nextName) {
      const { error: cascadeErr } = await supabase
        .from("parts")
        .update({ category: nextName })
        .eq("category", prev.name);
      if (cascadeErr) throw cascadeErr;
    }

    revalidatePricing("categories");
    revalidatePath("/settings/pricing/parts");
    return data as PartCategory;
  },
});

export const togglePartCategoryActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner"],
  handler: async (input): Promise<PartCategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("part_categories")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("categories");
    revalidatePath("/settings/pricing/parts");
    return data as PartCategory;
  },
});

// ============================================================================
// part_brands — create / update (with cascade rename on parts) / toggle
// ============================================================================

export const createPartBrand = wrapAction({
  schema: CreatePartBrandInput,
  roles: ["owner"],
  handler: async (input): Promise<PartBrand> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("part_brands")
      .insert({ ...input, name: input.name.trim() })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("brands");
    revalidatePath("/settings/pricing/parts");
    return data as PartBrand;
  },
});

export const updatePartBrand = wrapAction({
  schema: UpdatePartBrandInput,
  roles: ["owner"],
  handler: async ({ id, ...fields }): Promise<PartBrand> => {
    const supabase = await createClient();
    const { data: prev, error: prevErr } = await supabase
      .from("part_brands")
      .select("name")
      .eq("id", id)
      .single();
    if (prevErr) throw prevErr;

    const nextName = fields.name.trim();
    const { data, error } = await supabase
      .from("part_brands")
      .update({ ...fields, name: nextName })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    if (prev && prev.name !== nextName) {
      const { error: cascadeErr } = await supabase
        .from("parts")
        .update({ brand: nextName })
        .eq("brand", prev.name);
      if (cascadeErr) throw cascadeErr;
    }

    revalidatePricing("brands");
    revalidatePath("/settings/pricing/parts");
    return data as PartBrand;
  },
});

export const togglePartBrandActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner"],
  handler: async (input): Promise<PartBrand> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("part_brands")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePricing("brands");
    revalidatePath("/settings/pricing/parts");
    return data as PartBrand;
  },
});

/**
 * Transparent upsert used when the user types a brand-new category/brand name
 * in the Part form. Creates the row if missing; does nothing if it already
 * exists. Returns the canonical name (trimmed).
 */
export const ensurePartCategory = wrapAction({
  schema: z.object({ name: z.string().trim().min(1).max(80) }),
  roles: ["owner"],
  handler: async (input): Promise<{ name: string }> => {
    const supabase = await createClient();
    const name = input.name.trim();
    const { error } = await supabase
      .from("part_categories")
      .upsert({ name }, { onConflict: "name", ignoreDuplicates: true });
    if (error) throw error;
    revalidatePricing("categories");
    return { name };
  },
});

export const ensurePartBrand = wrapAction({
  schema: z.object({ name: z.string().trim().min(1).max(80) }),
  roles: ["owner"],
  handler: async (input): Promise<{ name: string }> => {
    const supabase = await createClient();
    const name = input.name.trim();
    const { error } = await supabase
      .from("part_brands")
      .upsert({ name }, { onConflict: "name", ignoreDuplicates: true });
    if (error) throw error;
    revalidatePricing("brands");
    return { name };
  },
});
