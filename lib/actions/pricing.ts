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
  PartPackage,
  PartPackageItem,
  PartPackageItemRow,
  PartPackageWithItems,
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
  CreatePartPackageInput,
  CreateServiceCostInput,
  CreateVolumeTierInput,
  DeleteEngineFilterInput,
  DeleteVolumeTierInput,
  LockPartPackageInput,
  MergePartPackagePricesInput,
  ToggleActiveInput,
  UnlockPartPackageInput,
  UpdateEngineTypeInput,
  UpdateOilTypeInput,
  UpdatePartBrandInput,
  UpdatePartCategoryInput,
  UpdatePartInput,
  UpdatePartPackageInput,
  UpdateServiceCostInput,
  UpdateVolumeTierInput,
  UpsertEngineFilterInput,
} from "@/lib/schemas/pricing";
import {
  effectiveCatalogPriceForItem,
  isPartPackageLocked,
} from "@/lib/utils/package-pricing";
import { normalizePartPricing } from "@/lib/utils/part-pricing";
import { computePartSellTiers } from "@/lib/utils/part-sell-prices";
import { excelOilLabel } from "@/lib/utils/oil-labels";
import { applyPartsSearch } from "@/lib/utils/parts-search";
import { TRANSMISSION_KIND_LABEL } from "@/lib/utils/transmission";

// ============================================================================
// Read-only catalog queries — RLS already allows SELECT to all authenticated.
// Cost columns are stripped from the response for non-owners.
// ============================================================================

const CUSTOMER_VIEW_HIDDEN_KEYS: (keyof Part)[] = ["cost", "mhsw_fee", "margin_value"];

// Shape returned by Supabase when we select a parts row joined to its category.
type PartJoinRow = Omit<Part, "category" | "unit_of_measure"> & {
  part_categories: {
    name: string;
    unit_of_measure: Part["unit_of_measure"];
  } | null;
};

const PART_SELECT = "*, part_categories:category_id(name, unit_of_measure)";

function mergePartCategory<T extends PartJoinRow>(
  row: T,
): T & Pick<Part, "category" | "unit_of_measure"> {
  const cat = row.part_categories;
  return {
    ...row,
    category: cat?.name ?? "",
    unit_of_measure: cat?.unit_of_measure ?? "pcs",
  };
}

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
  category_id?: string;
  brand?: string;
  q?: string;
}): Promise<PriceListRow[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  let q = supabase
    .from("parts")
    .select(`${PART_SELECT}, service_costs:service_cost_id(name)`)
    .eq("active", true)
    .order("brand")
    .order("part_number")
    .limit(2000);

  if (filter?.category_id) q = q.eq("category_id", filter.category_id);
  if (filter?.brand) q = q.eq("brand", filter.brand);
  if (filter?.q) {
    const term = `%${filter.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    q = q.or(`part_number.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const hideCost = (profile.role !== "owner" && profile.role !== "co_owner");
  type Row = PartJoinRow & { service_costs: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const merged = mergePartCategory(r);
    const row: PriceListRow = {
      ...normalizePartPricing(merged),
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
  /** Gallon price BEFORE tax. */
  gallon: number | null;
  /** Gallon price WITH HST applied — null when oil_types.is_taxable is false. */
  gallon_with_tax: number | null;
}

export async function getOilChangeGrid(): Promise<{
  engines: EngineType[];
  oilTypes: OilType[];
  cells: Map<string, PriceGridCell>;
  hstRate: number;
}> {
  const supabase = await createClient();

  // Mirrors public.oil_change_price(): one batched read per table instead of
  // engines×oil_types×containers RPCs (the prior approach overwhelmed the
  // request pipeline and surfaced as RangeError on this page).
  const [enginesRes, oilTypesRes, filtersRes, tiersRes, overridesRes, settingsRes] =
    await Promise.all([
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
        .eq("is_engine_oil", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("engine_filters")
        .select("engine_type_id, quantity, parts:part_id(cost, mhsw_fee, service_costs:service_cost_id(cost))"),
      supabase.from("volume_tiers").select("oil_type_id, min_litres, premium"),
      supabase
        .from("engine_sell_prices")
        .select("engine_type_id, oil_type_id, container, sell_price")
        .limit(10000),  // Supabase REST defaults to 1000; we have ~1400+ rows.
      supabase.from("app_settings").select("hst_rate").eq("id", 1).single(),
    ]);

  if (enginesRes.error) throw enginesRes.error;
  if (oilTypesRes.error) throw oilTypesRes.error;
  if (filtersRes.error) throw filtersRes.error;
  if (tiersRes.error) throw tiersRes.error;
  if (overridesRes.error) throw overridesRes.error;
  const hstRate = Number(settingsRes.data?.hst_rate ?? 0.13);

  // Build override lookup: "engine|oil|container" -> sell_price
  type OverrideRow = {
    engine_type_id: string;
    oil_type_id: string;
    container: "bulk" | "gallon";
    sell_price: number;
  };
  const overrideMap = new Map<string, number>();
  for (const o of (overridesRes.data ?? []) as OverrideRow[]) {
    overrideMap.set(`${o.engine_type_id}|${o.oil_type_id}|${o.container}`, Number(o.sell_price));
  }

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

  /** Round any positive price up to the next .99. Anything ≤ 0 → null so the
   *  UI shows "—" instead of a nonsensical "-$0.01" for oils with no cost. */
  const round99 = (sell: number): number | null =>
    Number.isFinite(sell) && sell > 0 ? Math.ceil(sell) - 0.01 : null;

  const cells = new Map<string, PriceGridCell>();
  for (const e of engines) {
    const capacity = Number(e.oil_capacity_litres);
    const filterCost = enginePartCost.get(e.id) ?? 0;
    const serviceCost = engineServiceCost.get(e.id) ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) {
      for (const o of oilTypes) {
        cells.set(`${e.id}|${o.id}`, {
          engine_id: e.id,
          oil_type_id: o.id,
          bulk: null,
          gallon: null,
          gallon_with_tax: null,
        });
      }
      continue;
    }
    for (const o of oilTypes) {
      const tier = tierPremiumFor(o.id, capacity);
      const bulkRate = Number(o.bulk_cost_per_litre);
      // gallon_cost_per_litre stores price per gallon container; divide by the
      // oil's own litres_per_gallon to get $/litre. Different oils ship in
      // different gallon sizes (Imperial 4.546, US 3.785, metric 4.0).
      const lpg = Number(o.litres_per_gallon);
      const gallonRate =
        Number.isFinite(lpg) && lpg > 0
          ? Number(o.gallon_cost_per_litre) / lpg
          : NaN;
      // Override wins; otherwise fall back to cost-up. round99 returns null
      // when the raw price isn't positive (oil has no cost configured), so
      // "—" shows instead of -$0.01.
      const overrideBulk   = overrideMap.get(`${e.id}|${o.id}|bulk`);
      const overrideGallon = overrideMap.get(`${e.id}|${o.id}|gallon`);
      const bulk = overrideBulk != null
        ? overrideBulk
        : Number.isFinite(bulkRate) && bulkRate > 0
          ? round99(bulkRate * capacity + filterCost + serviceCost + tier)
          : null;
      const gallon = overrideGallon != null
        ? overrideGallon
        : Number.isFinite(gallonRate) && gallonRate > 0
          ? round99(gallonRate * capacity + filterCost + serviceCost + tier)
          : null;
      // Item #21 — apply HST when the oil type is flagged taxable.
      const gallon_with_tax =
        gallon != null && o.is_taxable
          ? Math.round(gallon * (1 + hstRate) * 100) / 100
          : null;
      cells.set(`${e.id}|${o.id}`, {
        engine_id: e.id,
        oil_type_id: o.id,
        bulk,
        gallon,
        gallon_with_tax,
      });
    }
  }

  return { engines, oilTypes, cells, hstRate };
}

// ============================================================================
// "All Filter Sell Price" — mirrors the eponymous Excel tab. Computes the 4
// service-mode prices per filter and rounds each to .99.
//
//   With Service   = (cost + mhsw) + service_cost              (installed)
//   Without Service= (cost + mhsw) + service_cost + counter_premium  (parts on the counter; labour for ringing up)
//   Over Counter   = With Service                              (separate pure-sale price; reserved for future per-part override)
//   Customer Supplies = customer_supplies_labour (flat — customer brings their own filter, QTL only does labour)
//
// Both the counter_premium and customer_supplies_labour are configurable on
// app_settings so the owner can tune them without touching code.
// ============================================================================

export interface FilterSellPriceRow {
  id: string;
  part_number: string;
  brand: string;
  category: string;
  description: string | null;
  list_price: number;
  cost: number;
  mhsw_fee: number;
  service_cost: number;
  service_cost_name: string | null;
  /** null when the part has no cost data — UI shows "—" instead of $-0.01. */
  without_service: number | null;
  with_service: number | null;
  over_counter: number | null;
  customer_supplies: number;
}

export async function getAllFilterSellPrices(filter?: {
  category_id?: string;
  brand?: string;
  q?: string;
}): Promise<{
  rows: FilterSellPriceRow[];
  counter_premium: number;
  customer_supplies_labour: number;
  effective_date: string | null;
}> {
  const supabase = await createClient();

  const [partsRes, settingsRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("parts")
        .select(`${PART_SELECT}, service_costs:service_cost_id(name, cost)`)
        .eq("active", true)
        .order("brand")
        .order("part_number")
        .limit(2000);
      if (filter?.category_id) q = q.eq("category_id", filter.category_id);
      if (filter?.brand) q = q.eq("brand", filter.brand);
      q = applyPartsSearch(q, filter?.q, [
        "part_number",
        "description",
        "brand",
      ]);
      return q;
    })(),
    supabase
      .from("app_settings")
      .select("counter_premium, customer_supplies_labour, price_list_effective_date")
      .eq("id", 1)
      .single(),
  ]);
  if (partsRes.error) throw partsRes.error;
  const counterPremium = Number(settingsRes.data?.counter_premium ?? 10);
  const customerSuppliesLabour = Number(settingsRes.data?.customer_supplies_labour ?? 20);
  const effectiveDate = settingsRes.data?.price_list_effective_date ?? null;

  type Row = PartJoinRow & {
    service_costs: { name: string; cost: number } | null;
    without_service_price: number | null;
    with_service_price: number | null;
    over_counter_price: number | null;
    in_package: boolean;
  };
  const rows: FilterSellPriceRow[] = ((partsRes.data ?? []) as unknown as Row[]).map((r) => {
    const merged = mergePartCategory(r);
    const part = normalizePartPricing(merged);
    const svcCost = Number(r.service_costs?.cost ?? 0);
    // Per-part overrides + per-part counter/labour (fall back to global) — see
    // computePartSellTiers. The override columns are populated from the Excel
    // "All Filter Sell Price" tab (see supabase/seed/may2026_*.sql).
    const tiers = computePartSellTiers(
      part,
      svcCost,
      counterPremium,
      customerSuppliesLabour,
    );
    const withSvc = tiers.with_service;
    const withoutSvc = tiers.without_service;
    const overCounter = tiers.over_counter;
    const customerSupplies = tiers.customer_supplies;
    return {
      id: part.id,
      part_number: part.part_number,
      brand: part.brand,
      category: part.category,
      description: part.description,
      list_price: Number(part.list_price),
      cost: Number(part.cost),
      mhsw_fee: Number(part.mhsw_fee),
      service_cost: svcCost,
      service_cost_name: r.service_costs?.name ?? null,
      without_service: withoutSvc,
      with_service: withSvc,
      over_counter: overCounter,
      customer_supplies: customerSupplies,
    };
  });

  return {
    rows,
    counter_premium: counterPremium,
    customer_supplies_labour: customerSuppliesLabour,
    effective_date: effectiveDate,
  };
}

// ============================================================================
// Per-oil pricing detail (mirrors the "15W40", "10W30", ... tabs).
//
// One row per engine, columns: Selling, Cost, Filter Cost, Oil Cost, Profit,
// Cost%, Profit%. The selling-price column is the same .99-rounded number the
// Oil-Change grid surfaces; cost columns are admin-only.
// ============================================================================

export interface OilDetailRow {
  engine_id: string;
  engine_name: string;
  oil_capacity_litres: number;
  selling: number | null;
  /** True when `selling` came from an engine_sell_prices override (vs cost-up). */
  is_override: boolean;
  /** ID of the engine_sell_prices row backing the override (null if cost-up). */
  override_id: string | null;
  filter_cost: number;
  oil_cost: number;
  service_cost: number;
  volume_tier_premium: number;
  total_cost: number;
  /** null when selling is null (no data to compute against). */
  profit: number | null;
  cost_pct: number | null;     // 0..1
  profit_pct: number | null;   // 0..1
}

export interface OilDetailResponse {
  oil_type: OilType;
  container: "bulk" | "gallon";
  rows: OilDetailRow[];
  /** All oil types (for the page selector). */
  oil_types: OilType[];
}

export async function getOilDetail(
  oilCode: string,
  container: "bulk" | "gallon",
): Promise<OilDetailResponse | null> {
  const supabase = await createClient();

  const [enginesRes, oilTypesRes, filtersRes, tiersRes, overridesRes] =
    await Promise.all([
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
      supabase
        .from("engine_sell_prices")
        .select("id, engine_type_id, oil_type_id, container, sell_price")
        .limit(10000),  // Supabase REST defaults to 1000; we have ~1400+ rows.
    ]);
  if (enginesRes.error) throw enginesRes.error;
  if (oilTypesRes.error) throw oilTypesRes.error;
  if (filtersRes.error) throw filtersRes.error;
  if (tiersRes.error) throw tiersRes.error;
  if (overridesRes.error) throw overridesRes.error;

  const oilTypes = (oilTypesRes.data ?? []) as OilType[];
  const oilType = oilTypes.find((o) => o.code === oilCode);
  if (!oilType) return null;

  type OverrideRow = {
    id: string;
    engine_type_id: string;
    oil_type_id: string;
    container: "bulk" | "gallon";
    sell_price: number;
  };
  const overrideMap = new Map<string, { id: string; price: number }>();
  for (const o of (overridesRes.data ?? []) as OverrideRow[]) {
    overrideMap.set(
      `${o.engine_type_id}|${o.oil_type_id}|${o.container}`,
      { id: o.id, price: Number(o.sell_price) },
    );
  }

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
    enginePartCost.set(
      f.engine_type_id,
      (enginePartCost.get(f.engine_type_id) ?? 0)
        + (Number(f.parts.cost) + Number(f.parts.mhsw_fee)) * qty,
    );
    engineServiceCost.set(
      f.engine_type_id,
      (engineServiceCost.get(f.engine_type_id) ?? 0)
        + Number(f.parts.service_costs?.cost ?? 0) * qty,
    );
  }

  type TierRow = { oil_type_id: string; min_litres: number; premium: number };
  const tiers = ((tiersRes.data ?? []) as TierRow[]).filter(
    (t) => t.oil_type_id === oilType.id,
  );
  const tierFor = (cap: number): number => {
    let best: TierRow | null = null;
    for (const t of tiers) {
      if (Number(t.min_litres) <= cap && (!best || Number(t.min_litres) > Number(best.min_litres))) {
        best = t;
      }
    }
    return best ? Number(best.premium) : 0;
  };

  /** Round any positive price up to the next .99. Anything ≤ 0 → null. */
  const round99 = (n: number): number | null =>
    Number.isFinite(n) && n > 0 ? Math.ceil(n) - 0.01 : null;

  const lpg = Number(oilType.litres_per_gallon);
  const perLitre = container === "gallon"
    ? (Number.isFinite(lpg) && lpg > 0 ? Number(oilType.gallon_cost_per_litre) / lpg : NaN)
    : Number(oilType.bulk_cost_per_litre);

  const rows: OilDetailRow[] = ((enginesRes.data ?? []) as EngineType[]).map((e) => {
    const cap = Number(e.oil_capacity_litres);
    const filterCost = enginePartCost.get(e.id) ?? 0;
    const serviceCost = engineServiceCost.get(e.id) ?? 0;
    const tier = tierFor(cap);
    const oilCost = Number.isFinite(perLitre) ? perLitre * cap : 0;
    const totalCost = filterCost + oilCost + serviceCost + tier;
    // Override wins; otherwise fall back to cost-up. round99 returns null when
    // the result isn't positive so we don't render "-$0.01" for empty oils.
    const override = overrideMap.get(`${e.id}|${oilType.id}|${container}`);
    const selling = override
      ? override.price
      : Number.isFinite(perLitre) && perLitre > 0
        ? round99(totalCost)
        : null;
    // When selling is null (no price data), profit/margin are also unknown —
    // return null so the UI shows "—" instead of "0%" or "100%".
    const profit = selling != null ? selling - totalCost : null;
    const costPct = selling != null && selling > 0 ? totalCost / selling : null;
    const profitPct = costPct != null ? 1 - costPct : null;
    return {
      engine_id: e.id,
      engine_name: `${e.manufacturer} ${e.model}`,
      oil_capacity_litres: cap,
      selling,
      is_override: !!override,
      override_id: override?.id ?? null,
      filter_cost: filterCost,
      oil_cost: oilCost,
      service_cost: serviceCost,
      volume_tier_premium: tier,
      total_cost: totalCost,
      profit,
      cost_pct: costPct,
      profit_pct: profitPct,
    };
  });

  return { oil_type: oilType, container, rows, oil_types: oilTypes };
}

// ============================================================================
// Print List — the technician's print-friendly price card. One row per engine,
// columns are gallon-container sell prices for every active oil type.
// ============================================================================

/** A single column on the Print List. Matches the Excel layout: each oil has
 *  a gallon column always; synthetic oils additionally have a bulk column;
 *  three reference bulk columns close out the table (15W40, 10W30, 5W30). */
export interface PrintListColumn {
  key: string;
  label: string;        // e.g. "Standard 15W-40"
  sublabel: string;     // e.g. "15W40 · Gallon"
  oil_type_id: string;
  container: "bulk" | "gallon";
  is_reference: boolean; // true for the 3 reference bulk columns at the end
}

export interface PrintListRow {
  engine_id: string;
  engine_name: string;
  oil_capacity_litres: number;
  /** Same length + order as PrintListResponse.columns. */
  prices: Array<number | null>;
}

export interface PrintListResponse {
  columns: PrintListColumn[];
  rows: PrintListRow[];
  effective_date: string | null;
  company_name: string;
}

/** Explicit ordered column list matching the Excel Print List tab exactly.
 *  Each entry is (DB oil_types.code, container, short_label, sublabel,
 *  is_reference). Labels mirror the Excel headers so spot-checking against
 *  the spreadsheet is one-to-one. */
const PRINT_LIST_COLUMNS: Array<{
  code: string;
  container: "bulk" | "gallon";
  label: string;
  sublabel: string;
  is_reference: boolean;
}> = [
  { code: "257004",    container: "gallon", label: "15W40",          sublabel: "Gallon",   is_reference: false },
  { code: "10",        container: "gallon", label: "10W30",          sublabel: "Gallon",   is_reference: false },
  { code: "500010047", container: "gallon", label: "T5",             sublabel: "Gallon",   is_reference: false },
  { code: "21",        container: "gallon", label: "Petro 10W30",    sublabel: "Gallon",   is_reference: false },
  { code: "14",        container: "bulk",   label: "T6",             sublabel: "5W30/5W40 Bulk", is_reference: false },
  { code: "14",        container: "gallon", label: "T6",             sublabel: "Gallon",   is_reference: false },
  { code: "11",        container: "bulk",   label: "Delo SYN 5W30",  sublabel: "Bulk",     is_reference: false },
  { code: "11",        container: "gallon", label: "Delo SYN 5W30",  sublabel: "Gallon",   is_reference: false },
  { code: "22",        container: "bulk",   label: "Petro SYN 5W30", sublabel: "Bulk",     is_reference: false },
  { code: "22",        container: "gallon", label: "Petro SYN 5W30", sublabel: "Gallon",   is_reference: false },
  // 3 reference bulk columns at the end (Excel cols V / X / Y)
  { code: "257004",    container: "bulk",   label: "15W40",          sublabel: "Bulk ref", is_reference: true  },
  { code: "10",        container: "bulk",   label: "10W30",          sublabel: "Bulk ref", is_reference: true  },
  { code: "11",        container: "bulk",   label: "5W30",           sublabel: "Bulk ref", is_reference: true  },
];

export async function getPrintList(): Promise<PrintListResponse> {
  const supabase = await createClient();
  const [{ engines, oilTypes, cells }, settingsRes] = await Promise.all([
    getOilChangeGrid(),
    supabase
      .from("app_settings")
      .select("company_name, price_list_effective_date")
      .eq("id", 1)
      .single(),
  ]);

  // Resolve each Excel column to its oil_type_id by code. Skip any column
  // whose oil isn't in the DB (defensive — shouldn't happen with the seed).
  const codeToOil = new Map(oilTypes.map((o) => [o.code, o]));
  const columns: PrintListColumn[] = [];
  for (const spec of PRINT_LIST_COLUMNS) {
    const o = codeToOil.get(spec.code);
    if (!o) continue;
    columns.push({
      key: `${spec.is_reference ? "ref-" : ""}${o.id}-${spec.container}`,
      label: spec.label,
      sublabel: spec.sublabel,
      oil_type_id: o.id,
      container: spec.container,
      is_reference: spec.is_reference,
    });
  }

  // First pass: build raw prices for every column so we can detect empty ones.
  type RawRow = {
    engine_id: string;
    engine_name: string;
    oil_capacity_litres: number;
    prices: Array<number | null>;
  };
  const rawRows: RawRow[] = engines.map((e) => ({
    engine_id: e.id,
    engine_name: `${e.manufacturer} ${e.model}`,
    oil_capacity_litres: Number(e.oil_capacity_litres),
    prices: columns.map((col) => {
      const cell = cells.get(`${e.id}|${col.oil_type_id}`);
      return col.container === "bulk" ? cell?.bulk ?? null : cell?.gallon ?? null;
    }),
  }));

  // Second pass: drop any column where no engine has a price. This keeps
  // transmission/differential/fuel "oils" (no engine-oil cost configured) out
  // of the Print List so it actually fits on the page and matches the Excel.
  const keepIdx: number[] = [];
  for (let i = 0; i < columns.length; i++) {
    if (rawRows.some((r) => r.prices[i] != null)) keepIdx.push(i);
  }
  const filteredColumns = keepIdx.map((i) => columns[i]);
  const rows: PrintListRow[] = rawRows.map((r) => ({
    engine_id: r.engine_id,
    engine_name: r.engine_name,
    oil_capacity_litres: r.oil_capacity_litres,
    prices: keepIdx.map((i) => r.prices[i]),
  }));

  return {
    columns: filteredColumns,
    rows,
    effective_date: settingsRes.data?.price_list_effective_date ?? null,
    company_name: settingsRes.data?.company_name ?? "Quick Truck Lube & Oil Ltd.",
  };
}

// ============================================================================
// Item #19 — Detailed oil-change pricing breakdown.
//
// For each engine we expose every filter brand option separately, plus a
// labour line (sum of service_costs across the engine's filter rows) and a
// grease/extras line picked up from any service_cost row whose code matches
// 'GREASE' (case-insensitive). The shape is intentionally wide so the page can
// pivot rows = engines × columns = brand variants without re-querying.
// ============================================================================

export interface OilChangeDetailBrand {
  brand: string;
  filter_cost: number;
  labour: number;
  parts: Array<{ part_number: string; quantity: number; cost: number; mhsw_fee: number }>;
}

export interface OilChangeDetailRow {
  engine: EngineType;
  brands: OilChangeDetailBrand[];
  grease: number;
}

export async function getOilChangeDetails(): Promise<{
  rows: OilChangeDetailRow[];
  hstRate: number;
}> {
  const supabase = await createClient();

  const [enginesRes, filtersRes, settingsRes, greaseRes] = await Promise.all([
    supabase
      .from("engine_types")
      .select("*")
      .eq("active", true)
      .order("manufacturer")
      .order("model"),
    supabase
      .from("engine_filters")
      .select(
        "engine_type_id, quantity, parts:part_id(brand, part_number, cost, mhsw_fee, service_costs:service_cost_id(cost))",
      ),
    supabase.from("app_settings").select("hst_rate").eq("id", 1).single(),
    supabase.from("service_costs").select("cost").ilike("code", "%grease%").maybeSingle(),
  ]);

  if (enginesRes.error) throw enginesRes.error;
  if (filtersRes.error) throw filtersRes.error;
  const hstRate = Number(settingsRes.data?.hst_rate ?? 0.13);
  const grease = Number(greaseRes.data?.cost ?? 0);

  type FilterJoin = {
    engine_type_id: string;
    quantity: number;
    parts: {
      brand: string;
      part_number: string;
      cost: number;
      mhsw_fee: number;
      service_costs: { cost: number } | null;
    } | null;
  };

  const grouped = new Map<string, Map<string, OilChangeDetailBrand>>();
  for (const r of (filtersRes.data ?? []) as unknown as FilterJoin[]) {
    if (!r.parts) continue;
    const qty = Number(r.quantity) || 0;
    const part = r.parts;
    const brand = part.brand ?? "(none)";
    const filterCost = (Number(part.cost) + Number(part.mhsw_fee)) * qty;
    const labourCost = Number(part.service_costs?.cost ?? 0) * qty;

    const byEngine = grouped.get(r.engine_type_id) ?? new Map<string, OilChangeDetailBrand>();
    const slot =
      byEngine.get(brand) ??
      ({ brand, filter_cost: 0, labour: 0, parts: [] } satisfies OilChangeDetailBrand);
    slot.filter_cost += filterCost;
    slot.labour += labourCost;
    slot.parts.push({
      part_number: part.part_number,
      quantity: qty,
      cost: Number(part.cost),
      mhsw_fee: Number(part.mhsw_fee),
    });
    byEngine.set(brand, slot);
    grouped.set(r.engine_type_id, byEngine);
  }

  const rows: OilChangeDetailRow[] = ((enginesRes.data ?? []) as EngineType[]).map((e) => ({
    engine: e,
    brands: Array.from(grouped.get(e.id)?.values() ?? []).sort((a, b) =>
      a.brand.localeCompare(b.brand),
    ),
    grease,
  }));

  return { rows, hstRate };
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
  roles: ["owner", "co_owner"],
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
  category_id?: string;
  brand?: string;
  q?: string;
}): Promise<AdminPartRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("parts")
    .select(`${PART_SELECT}, service_costs:service_cost_id(name)`)
    .order("brand")
    .order("part_number")
    .limit(2000);

  if (filter?.category_id) query = query.eq("category_id", filter.category_id);
  if (filter?.brand) query = query.eq("brand", filter.brand);
  if (filter?.q) {
    const term = `%${filter.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(`part_number.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  type Row = PartJoinRow & { service_costs: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const merged = mergePartCategory(r);
    return {
      ...normalizePartPricing(merged),
      service_cost_name: r.service_costs?.name ?? null,
    };
  });
}

/**
 * Active categories for dropdown suggestions in the Part form. Returns the
 * id (so a Select can submit a category_id), the name, and the unit_of_measure
 * so the UI can show "Filters (pcs)" etc.
 */
export type PartCategoryOption = Pick<
  PartCategory,
  "id" | "name" | "unit_of_measure"
>;

export async function listPartCategories(): Promise<PartCategoryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("part_categories")
    .select("id, name, unit_of_measure")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as PartCategoryOption[];
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

/** A pickable part plus its computed sell tiers (With Service / Without Service
 *  / Over Counter + Customer Supplies). Used by the sales job part-add dialog so
 *  the user can choose which price applies. Tiers fold in per-part counter
 *  premium / customer-supplies labour with the global fallback. */
export type PartForPicker = Part & {
  with_service: number | null;
  without_service: number | null;
  over_counter: number | null;
  customer_supplies: number;
};

export async function listPartsForPicker(q?: string): Promise<PartForPicker[]> {
  const supabase = await createClient();
  let query = supabase
    .from("parts")
    .select(`${PART_SELECT}, service_costs:service_cost_id(cost)`)
    .eq("active", true)
    .order("brand")
    .order("part_number")
    .limit(50);
  query = applyPartsSearch(query, q, [
    "part_number",
    "description",
    "brand",
  ]);
  const [partsRes, settingsRes] = await Promise.all([
    query,
    supabase
      .from("app_settings")
      .select("counter_premium, customer_supplies_labour")
      .eq("id", 1)
      .single(),
  ]);
  if (partsRes.error) throw partsRes.error;
  const counterPremium = Number(settingsRes.data?.counter_premium ?? 10);
  const customerSuppliesLabour = Number(settingsRes.data?.customer_supplies_labour ?? 20);
  type Row = PartJoinRow & { service_costs: { cost: number } | null };
  return ((partsRes.data ?? []) as unknown as Row[]).map((row) => {
    const part = normalizePartPricing(mergePartCategory(row));
    const svcCost = Number(row.service_costs?.cost ?? 0);
    const tiers = computePartSellTiers(
      part,
      svcCost,
      counterPremium,
      customerSuppliesLabour,
    );
    return {
      ...part,
      with_service: tiers.with_service,
      without_service: tiers.without_service,
      over_counter: tiers.over_counter,
      customer_supplies: tiers.customer_supplies,
    };
  });
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
    .select("*, part:part_id(*, part_categories:category_id(name, unit_of_measure))")
    .eq("engine_type_id", id)
    .order("id");
  if (fErr) throw fErr;

  type Row = EngineFilter & { part: PartJoinRow };
  const rows = ((filters ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    part: mergePartCategory(r.part),
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
  revalidatePath("/pricing/all-filter-price");
  revalidatePath("/pricing/oil-detail");
  revalidatePath("/pricing/print-list");
  revalidatePath("/settings/pricing");
  if (entity) revalidatePath(`/settings/pricing/${entity}`);
}

// ============================================================================
// oil_types — create / update / toggle active
// ============================================================================

export const createOilType = wrapAction({
  schema: CreateOilTypeInput,
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
 * Side-effect: if the part references a brand name that isn't yet in the
 * `part_brands` lookup, upsert it so the dropdown picks it up next time.
 * Categories are now FK-linked so they can't drift.
 */
async function syncBrandRef(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brand: string,
) {
  const br = brand.trim();
  if (!br) return;
  const { error } = await supabase
    .from("part_brands")
    .upsert({ name: br }, { onConflict: "name", ignoreDuplicates: true });
  if (error) console.error("[syncBrandRef]", error);
}

// Lightweight, debounce-friendly check for the Part form's "this part number
// is already in the catalog" warning. Match is case-insensitive on
// part_number alone — the (part_number, brand) unique constraint is the
// hard guard at the DB level; this surfaces same-number-different-brand
// collisions too because that's almost always a typo / duplicate entry.
export async function checkPartNumberExists(input: {
  part_number: string;
  excludeId?: string | null;
}): Promise<{ exists: boolean; matches: { id: string; part_number: string; brand: string; active: boolean }[] }> {
  const partNumber = input.part_number.trim();
  if (partNumber.length < 2) return { exists: false, matches: [] };

  const supabase = await createClient();
  let query = supabase
    .from("parts")
    .select("id, part_number, brand, active")
    .ilike("part_number", partNumber)
    .limit(5);
  if (input.excludeId) query = query.neq("id", input.excludeId);

  const { data, error } = await query;
  if (error) throw error;
  const matches = (data ?? []) as { id: string; part_number: string; brand: string; active: boolean }[];
  return { exists: matches.length > 0, matches };
}

export const createPart = wrapAction({
  schema: CreatePartInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Part> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("parts")
      .insert(input)
      .select(PART_SELECT)
      .single();
    if (error) throw error;
    await syncBrandRef(supabase, input.brand);
    revalidatePricing("parts");
    revalidatePath("/settings/pricing/categories");
    revalidatePath("/settings/pricing/brands");
    return mergePartCategory(data as unknown as PartJoinRow);
  },
});

export const updatePart = wrapAction({
  schema: UpdatePartInput,
  roles: ["owner", "co_owner"],
  handler: async ({ id, ...fields }): Promise<Part> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("parts")
      .update(fields)
      .eq("id", id)
      .select(PART_SELECT)
      .single();
    if (error) throw error;
    await syncBrandRef(supabase, fields.brand);
    revalidatePricing("parts");
    revalidatePath("/settings/pricing/categories");
    revalidatePath("/settings/pricing/brands");
    return mergePartCategory(data as unknown as PartJoinRow);
  },
});

export const togglePartActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Part> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("parts")
      .update({ active: input.active })
      .eq("id", input.id)
      .select(PART_SELECT)
      .single();
    if (error) throw error;
    revalidatePricing("parts");
    return mergePartCategory(data as unknown as PartJoinRow);
  },
});

// ============================================================================
// service_costs — create / update / toggle active
// ============================================================================

export const createServiceCost = wrapAction({
  schema: CreateServiceCostInput,
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Part[]> => {
    return listPartsForPicker(input.q);
  },
});

// ============================================================================
// part_categories — create / update (with cascade rename on parts) / toggle
// ============================================================================

export const createPartCategory = wrapAction({
  schema: CreatePartCategoryInput,
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
  handler: async ({ id, ...fields }): Promise<PartCategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("part_categories")
      .update({ ...fields, name: fields.name.trim() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    // Parts are FK-linked, so a name change is automatically visible on every
    // part — no cascade needed.
    revalidatePricing("categories");
    revalidatePath("/settings/pricing/parts");
    return data as PartCategory;
  },
});

export const togglePartCategoryActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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
  roles: ["owner", "co_owner"],
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

// ============================================================================
// Price history (audit log for cost / list-price / mhsw / oil cost / labour)
// ============================================================================

export interface PriceHistoryRow {
  id: string;
  entity_type: "part" | "oil_type" | "service_cost";
  entity_id: string;
  field: string;
  old_value: number | null;
  new_value: number | null;
  changed_by: string | null;
  changed_at: string;
  entity_label: string;
  changed_by_label: string | null;
}

export async function listPriceHistory(
  limit = 200,
): Promise<PriceHistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as Omit<PriceHistoryRow, "entity_label" | "changed_by_label">[];
  if (rows.length === 0) return [];

  const partIds = rows.filter((r) => r.entity_type === "part").map((r) => r.entity_id);
  const oilIds = rows.filter((r) => r.entity_type === "oil_type").map((r) => r.entity_id);
  const svcIds = rows.filter((r) => r.entity_type === "service_cost").map((r) => r.entity_id);
  const userIds = rows.map((r) => r.changed_by).filter((v): v is string => !!v);

  const [parts, oils, svcs, users] = await Promise.all([
    partIds.length
      ? supabase.from("parts").select("id, part_number, brand").in("id", partIds)
      : Promise.resolve({ data: [] }),
    oilIds.length
      ? supabase.from("oil_types").select("id, code, name").in("id", oilIds)
      : Promise.resolve({ data: [] }),
    svcIds.length
      ? supabase.from("service_costs").select("id, code, name").in("id", svcIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const partMap = new Map(((parts.data ?? []) as { id: string; part_number: string; brand: string }[]).map((p) => [p.id, `${p.brand} ${p.part_number}`]));
  const oilMap = new Map(((oils.data ?? []) as { id: string; code: string; name: string }[]).map((o) => [o.id, `${o.code} — ${o.name}`]));
  const svcMap = new Map(((svcs.data ?? []) as { id: string; code: string; name: string }[]).map((s) => [s.id, `${s.code} — ${s.name}`]));
  const userMap = new Map(((users.data ?? []) as { id: string; full_name: string | null; email: string }[]).map((u) => [u.id, u.full_name ?? u.email]));

  return rows.map((r) => ({
    ...r,
    entity_label:
      r.entity_type === "part"
        ? partMap.get(r.entity_id) ?? "(deleted part)"
        : r.entity_type === "oil_type"
        ? oilMap.get(r.entity_id) ?? "(deleted oil type)"
        : svcMap.get(r.entity_id) ?? "(deleted service cost)",
    changed_by_label: r.changed_by ? userMap.get(r.changed_by) ?? null : null,
  }));
}

// ============================================================================
// Min-margin alerts — list active parts whose margin is below the configured
// app_settings.min_margin_alert_pct threshold. Margin = list_price - cost - mhsw,
// expressed as a fraction of list_price.
// ============================================================================

export interface LowMarginPart {
  id: string;
  part_number: string;
  brand: string;
  category: string;
  cost: number;
  list_price: number;
  mhsw_fee: number;
  margin_amount: number;
  margin_pct: number;
}

export async function listLowMarginParts(): Promise<{
  threshold_pct: number;
  parts: LowMarginPart[];
}> {
  const supabase = await createClient();
  const [{ data: settings, error: setErr }, { data: parts, error: partsErr }] = await Promise.all([
    supabase.from("app_settings").select("min_margin_alert_pct").eq("id", 1).single(),
    supabase
      .from("parts")
      .select(
        "id, part_number, brand, cost, list_price, mhsw_fee, part_categories:category_id(name)",
      )
      .eq("active", true),
  ]);
  if (setErr) throw setErr;
  if (partsErr) throw partsErr;

  const thresholdFrac = Number((settings as { min_margin_alert_pct: number } | null)?.min_margin_alert_pct ?? 0);
  if (thresholdFrac <= 0) return { threshold_pct: 0, parts: [] };

  type Row = {
    id: string;
    part_number: string;
    brand: string;
    cost: number;
    list_price: number;
    mhsw_fee: number;
    part_categories: { name: string } | null;
  };
  const list = (parts ?? []) as unknown as Row[];
  const flagged: LowMarginPart[] = [];
  for (const p of list) {
    const lp = Number(p.list_price);
    if (lp <= 0) continue;
    const marginAmount = lp - Number(p.cost) - Number(p.mhsw_fee);
    const marginFrac = marginAmount / lp;
    if (marginFrac < thresholdFrac) {
      flagged.push({
        id: p.id,
        part_number: p.part_number,
        brand: p.brand,
        category: p.part_categories?.name ?? "",
        cost: Number(p.cost),
        list_price: lp,
        mhsw_fee: Number(p.mhsw_fee),
        margin_amount: Math.round(marginAmount * 100) / 100,
        margin_pct: Math.round(marginFrac * 1000) / 10,
      });
    }
  }
  flagged.sort((a, b) => a.margin_pct - b.margin_pct);
  return { threshold_pct: Math.round(thresholdFrac * 1000) / 10, parts: flagged };
}

// ============================================================================
// Sales-form auto-fill — wrapper around oil_change_price() RPC.
// ============================================================================

export const lookupOilChangePrice = wrapAction({
  schema: z.object({
    engine_type_id: z.string().uuid(),
    oil_type_id: z.string().uuid(),
    oil_container: z.enum(["bulk", "gallon"]),
  }),
  roles: ["owner", "co_owner", "manager", "staff"],
  handler: async (input): Promise<{ sub_total: number | null }> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("oil_change_price", {
      p_engine_id: input.engine_type_id,
      p_oil_type_id: input.oil_type_id,
      p_container: input.oil_container,
    });
    if (error) throw error;
    return { sub_total: data == null ? null : Number(data) };
  },
});

// ============================================================================
// engine_sell_prices — manual override per (engine, oil, container).
// Owner-only writes. Fall-through to cost-up if no row exists.
// ============================================================================

export interface EngineSellPriceRow {
  id: string;
  engine_type_id: string;
  oil_type_id: string;
  container: "bulk" | "gallon";
  sell_price: number;
  notes: string | null;
}

export async function listEngineSellPrices(): Promise<EngineSellPriceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engine_sell_prices")
    .select("id, engine_type_id, oil_type_id, container, sell_price, notes")
    .order("engine_type_id")
    .limit(10000);  // Supabase REST defaults to 1000; we have ~1400+ rows.
  if (error) throw error;
  return (data ?? []) as EngineSellPriceRow[];
}

const UpsertEngineSellPriceInput = z.object({
  engine_type_id: z.string().uuid(),
  oil_type_id: z.string().uuid(),
  container: z.enum(["bulk", "gallon"]),
  sell_price: z.coerce.number().positive("Must be greater than zero"),
  notes: z.string().trim().max(200).nullable().optional().or(z.literal("")),
});

export const upsertEngineSellPrice = wrapAction({
  schema: UpsertEngineSellPriceInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<EngineSellPriceRow> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("engine_sell_prices")
      .upsert(
        {
          engine_type_id: input.engine_type_id,
          oil_type_id: input.oil_type_id,
          container: input.container,
          sell_price: input.sell_price,
          notes: input.notes || null,
          created_by: profile.id,
          updated_by: profile.id,
        },
        { onConflict: "engine_type_id,oil_type_id,container" },
      )
      .select("id, engine_type_id, oil_type_id, container, sell_price, notes")
      .single();
    if (error) throw error;
    revalidatePricing("sell-prices");
    return data as EngineSellPriceRow;
  },
});

export const deleteEngineSellPrice = wrapAction({
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ id: string }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("engine_sell_prices")
      .delete()
      .eq("id", input.id);
    if (error) throw error;
    revalidatePricing("sell-prices");
    return { id: input.id };
  },
});

// ============================================================================
// Pricing-related app_settings — counter premium + customer-supplies labour
// (these are the GLOBAL DEFAULTS; per-part values override them), and the
// price-list effective date. Owner-only.
//
// NOTE: vacation_pay_rate / wsib_rate used to live here too, but they are a
// payroll concern and now live in the Payroll settings panel
// (updatePayrollSettings in lib/actions/payroll.ts). They are still stored on
// app_settings — just edited from /payroll.
// ============================================================================

const PricingSettingsInput = z.object({
  counter_premium: z.coerce.number().min(0),
  customer_supplies_labour: z.coerce.number().min(0),
  price_list_effective_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal("")),
});

export const updatePricingSettings = wrapAction({
  schema: PricingSettingsInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({
        counter_premium: input.counter_premium,
        customer_supplies_labour: input.customer_supplies_labour,
        price_list_effective_date: input.price_list_effective_date || null,
      })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/settings/pricing");
    revalidatePath("/pricing/all-filter-price");
    revalidatePath("/pricing/print-list");
    return { ok: true };
  },
});

export const updateMinMarginAlertPct = wrapAction({
  schema: z.object({ pct: z.coerce.number().min(0).max(100) }),
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ pct: number }> => {
    const supabase = await createClient();
    const frac = Math.round((input.pct / 100) * 10000) / 10000;
    const { error } = await supabase
      .from("app_settings")
      .update({ min_margin_alert_pct: frac })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/settings/pricing");
    revalidatePath("/analytics/products");
    return { pct: input.pct };
  },
});

// ============================================================================
// part_packages — pre-defined bundles of parts the user can drop onto a job
// ============================================================================

function revalidatePartPackages() {
  revalidatePath("/settings/pricing");
  revalidatePath("/settings/pricing/packages");
  revalidatePath("/sales/new");
}

async function fetchPackageItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packageIds: string[],
): Promise<Map<string, PartPackageItemRow[]>> {
  const out = new Map<string, PartPackageItemRow[]>();
  if (packageIds.length === 0) return out;
  const { data, error } = await supabase
    .from("part_package_items")
    .select(
      "id, package_id, part_id, quantity, unit_price, locked_unit_price, position, created_at, oil_type_id, litres, oil_container, transmission_service_id, " +
        "part:parts(id, brand, part_number, description, list_price, extra_price, category_id, cost, mhsw_fee, is_taxable, part_categories:category_id(name, unit_of_measure)), " +
        "oil_type:oil_types(id, code, name, bulk_cost_per_litre, gallon_cost_per_litre, litres_per_gallon, is_taxable), " +
        "transmission_service:transmission_services(id, name, service_kind, is_synthetic, sell_price, labour, litres, oil_types:oil_type_id(code, name))",
    )
    .in("package_id", packageIds)
    .order("position");
  if (error) throw error;
  type PartShape = {
    id: string;
    brand: string;
    part_number: string;
    description: string | null;
    list_price: number;
    extra_price: number;
    category_id: string;
    cost: number;
    mhsw_fee: number;
    is_taxable: boolean;
    part_categories: {
      name: string;
      unit_of_measure: Part["unit_of_measure"];
    } | null;
  };
  type OilShape = {
    id: string;
    code: string;
    name: string;
    bulk_cost_per_litre: number;
    gallon_cost_per_litre: number;
    litres_per_gallon: number;
    is_taxable: boolean;
  };
  type TransShape = {
    id: string;
    name: string;
    service_kind: string;
    is_synthetic: boolean;
    sell_price: number;
    labour: number | null;
    litres: number | null;
    oil_types: { code: string; name: string } | null;
  };
  type RowFromDb = Omit<PartPackageItem, "id"> & {
    id: string;
    part: PartShape | null;
    oil_type: OilShape | null;
    transmission_service: TransShape | null;
  };
  for (const row of (data ?? []) as unknown as RowFromDb[]) {
    const cat = row.part?.part_categories;
    const merged: PartPackageItemRow = {
      id: row.id,
      package_id: row.package_id,
      part_id: row.part_id,
      quantity: row.quantity,
      unit_price: row.unit_price,
      locked_unit_price: row.locked_unit_price,
      position: row.position,
      created_at: row.created_at,
      oil_type_id: row.oil_type_id,
      litres: row.litres,
      oil_container: row.oil_container,
      transmission_service_id: row.transmission_service_id,
      part: row.part
        ? {
            id: row.part.id,
            brand: row.part.brand,
            part_number: row.part.part_number,
            description: row.part.description,
            list_price: Number(row.part.list_price),
            extra_price: Number(row.part.extra_price ?? 0),
            category_id: row.part.category_id,
            cost: Number(row.part.cost),
            mhsw_fee: Number(row.part.mhsw_fee),
            is_taxable: row.part.is_taxable,
            category: cat?.name ?? "",
            unit_of_measure: cat?.unit_of_measure ?? "pcs",
          }
        : null,
      oil_type: row.oil_type ?? null,
      transmission_service: row.transmission_service
        ? {
            id: row.transmission_service.id,
            name: row.transmission_service.name,
            service_kind: row.transmission_service.service_kind,
            is_synthetic: row.transmission_service.is_synthetic,
            sell_price: Number(row.transmission_service.sell_price),
            labour:
              row.transmission_service.labour == null
                ? null
                : Number(row.transmission_service.labour),
            litres: row.transmission_service.litres,
            oil_type_name: row.transmission_service.oil_types
              ? excelOilLabel(
                  row.transmission_service.oil_types.code,
                  row.transmission_service.oil_types.name,
                )
              : null,
          }
        : null,
    };
    const arr = out.get(row.package_id) ?? [];
    arr.push(merged);
    out.set(row.package_id, arr);
  }
  return out;
}

export async function listAllPartPackages(): Promise<PartPackageWithItems[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("part_packages")
    .select("*")
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;
  const packages = (data ?? []) as PartPackage[];
  const itemsByPkg = await fetchPackageItems(supabase, packages.map((p) => p.id));
  return packages.map((p) => ({ ...p, items: itemsByPkg.get(p.id) ?? [] }));
}

export async function getPartPackage(id: string): Promise<PartPackageWithItems | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("part_packages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const itemsByPkg = await fetchPackageItems(supabase, [id]);
  return { ...(data as PartPackage), items: itemsByPkg.get(id) ?? [] };
}

export async function listPackagesForPicker(q?: string): Promise<PartPackageWithItems[]> {
  const supabase = await createClient();
  let query = supabase
    .from("part_packages")
    .select("*")
    .eq("active", true)
    .order("name")
    .limit(50);
  if (q && q.trim()) {
    const term = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(`name.ilike.${term},description.ilike.${term}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const packages = (data ?? []) as PartPackage[];
  const itemsByPkg = await fetchPackageItems(supabase, packages.map((p) => p.id));
  return packages.map((p) => ({ ...p, items: itemsByPkg.get(p.id) ?? [] }));
}

export const createPartPackage = wrapAction({
  schema: CreatePartPackageInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<PartPackage> => {
    const supabase = await createClient();
    const { data: pkg, error: pkgErr } = await supabase
      .from("part_packages")
      .insert({
        name: input.name.trim(),
        description: input.description ?? null,
        active: input.active,
        labor_selling_price: input.labor_selling_price,
        labor_description: input.labor_description ?? null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (pkgErr) throw pkgErr;

    const rows = input.items.map((it, i) => ({
      package_id: (pkg as PartPackage).id,
      part_id: it.part_id ?? null,
      transmission_service_id: it.transmission_service_id ?? null,
      quantity: it.quantity,
      unit_price: it.unit_price ?? null,
      position: i,
    }));
    const { error: itemsErr } = await supabase.from("part_package_items").insert(rows);
    if (itemsErr) throw itemsErr;

    revalidatePartPackages();
    return pkg as PartPackage;
  },
});

export const updatePartPackage = wrapAction({
  schema: UpdatePartPackageInput,
  roles: ["owner", "co_owner"],
  handler: async ({ id, items, ...fields }, profile): Promise<PartPackage> => {
    const supabase = await createClient();

    // Block edits while the package is locked — owner must unlock first or
    // use the merge dialog. Otherwise a delete-then-insert would wipe the
    // locked snapshots and silently break price stability.
    const { data: existing, error: existingErr } = await supabase
      .from("part_packages")
      .select("lock_until")
      .eq("id", id)
      .single();
    if (existingErr) throw existingErr;
    if (isPartPackageLocked(existing as { lock_until: string | null })) {
      throw new Error(
        "This package is price-locked. Unlock it before editing parts or labor.",
      );
    }

    const { data: pkg, error: pkgErr } = await supabase
      .from("part_packages")
      .update({
        name: fields.name.trim(),
        description: fields.description ?? null,
        active: fields.active,
        labor_selling_price: fields.labor_selling_price,
        labor_description: fields.labor_description ?? null,
        updated_by: profile.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (pkgErr) throw pkgErr;

    // Replace-all for the items this form manages (parts + Trans & Diff
    // services), preserving oil-typed rows — those are seeded / managed via the
    // oil-grid linkage and never sent through this form, so a blanket delete
    // would silently wipe them.
    const { error: delErr } = await supabase
      .from("part_package_items")
      .delete()
      .eq("package_id", id)
      .is("oil_type_id", null);
    if (delErr) throw delErr;

    // New part/trans rows go after any preserved oil rows.
    const { count: oilCount } = await supabase
      .from("part_package_items")
      .select("id", { count: "exact", head: true })
      .eq("package_id", id)
      .not("oil_type_id", "is", null);
    const offset = oilCount ?? 0;

    const rows = items.map((it, i) => ({
      package_id: id,
      part_id: it.part_id ?? null,
      transmission_service_id: it.transmission_service_id ?? null,
      quantity: it.quantity,
      unit_price: it.unit_price ?? null,
      position: offset + i,
    }));
    const { error: insErr } = await supabase.from("part_package_items").insert(rows);
    if (insErr) throw insErr;

    revalidatePartPackages();
    return pkg as PartPackage;
  },
});

export const lockPartPackage = wrapAction({
  schema: LockPartPackageInput,
  roles: ["owner", "co_owner"],
  handler: async ({ id, lock_until }, profile): Promise<PartPackage> => {
    const supabase = await createClient();

    // Pull the package + items so we can snapshot effective catalog prices.
    const itemsByPkg = await fetchPackageItems(supabase, [id]);
    const items = itemsByPkg.get(id) ?? [];

    const { data: pkgRow, error: pkgErr } = await supabase
      .from("part_packages")
      .select("*")
      .eq("id", id)
      .single();
    if (pkgErr) throw pkgErr;
    const pkg = pkgRow as PartPackage;

    // Snapshot each item's effective catalog price → locked_unit_price.
    for (const it of items) {
      const snap = effectiveCatalogPriceForItem(it);
      const { error } = await supabase
        .from("part_package_items")
        .update({ locked_unit_price: snap })
        .eq("id", it.id);
      if (error) throw error;
    }

    // Snapshot the labor selling price.
    const { data: updated, error: updErr } = await supabase
      .from("part_packages")
      .update({
        lock_until,
        labor_locked_selling_price: pkg.labor_selling_price,
        updated_by: profile.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr) throw updErr;

    revalidatePartPackages();
    return updated as PartPackage;
  },
});

export const unlockPartPackage = wrapAction({
  schema: UnlockPartPackageInput,
  roles: ["owner", "co_owner"],
  handler: async ({ id }, profile): Promise<PartPackage> => {
    const supabase = await createClient();

    const { error: clrErr } = await supabase
      .from("part_package_items")
      .update({ locked_unit_price: null })
      .eq("package_id", id);
    if (clrErr) throw clrErr;

    const { data: updated, error: updErr } = await supabase
      .from("part_packages")
      .update({
        lock_until: null,
        labor_locked_selling_price: null,
        updated_by: profile.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr) throw updErr;

    revalidatePartPackages();
    return updated as PartPackage;
  },
});

export const mergePartPackagePrices = wrapAction({
  schema: MergePartPackagePricesInput,
  roles: ["owner", "co_owner"],
  handler: async ({ id, items, labor_selling_price }, profile): Promise<PartPackage> => {
    const supabase = await createClient();

    // Apply the user's chosen prices: write both unit_price (the override the
    // catalog respects) AND locked_unit_price (the snapshot), so future edits
    // and future drift checks all share the same baseline.
    for (const it of items) {
      const { error } = await supabase
        .from("part_package_items")
        .update({
          unit_price: it.new_unit_price,
          locked_unit_price: it.new_unit_price,
        })
        .eq("id", it.item_id)
        .eq("package_id", id);
      if (error) throw error;
    }

    const { data: updated, error: updErr } = await supabase
      .from("part_packages")
      .update({
        labor_selling_price,
        labor_locked_selling_price: labor_selling_price,
        updated_by: profile.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr) throw updErr;

    revalidatePartPackages();
    return updated as PartPackage;
  },
});

export const togglePartPackageActive = wrapAction({
  schema: ToggleActiveInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<PartPackage> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("part_packages")
      .update({ active: input.active, updated_by: profile.id })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePartPackages();
    return data as PartPackage;
  },
});

// ============================================================================
// Trans & Diff — flat-priced service catalogue (Excel "Trans & Diff" tab).
// ============================================================================

export type TransmissionServiceKind =
  | "allison_trans"
  | "diff"
  | "trans"
  | "combined"
  | "specialty_trans"
  | "coolant_flush";

export interface TransmissionService {
  id: string;
  name: string;
  service_kind: TransmissionServiceKind;
  is_synthetic: boolean;
  oil_type_id: string | null;
  oil_type_name: string | null;
  litres: number | null;
  sell_price: number;
  labour: number | null;
  notes: string | null;
  sort_order: number;
  active: boolean;
}

export async function listTransmissionServices(): Promise<{
  groups: { kind: TransmissionServiceKind; label: string; rows: TransmissionService[] }[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transmission_services")
    .select("*, oil_types:oil_type_id(code, name)")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;

  type Row = Omit<TransmissionService, "oil_type_name"> & {
    oil_types: { code: string; name: string } | null;
  };
  const rows: TransmissionService[] = (data ?? []).map((r: Row) => ({
    id: r.id,
    name: r.name,
    service_kind: r.service_kind,
    is_synthetic: r.is_synthetic,
    oil_type_id: r.oil_type_id,
    oil_type_name: r.oil_types ? excelOilLabel(r.oil_types.code, r.oil_types.name) : null,
    litres: r.litres,
    sell_price: Number(r.sell_price),
    labour: r.labour == null ? null : Number(r.labour),
    notes: r.notes,
    sort_order: r.sort_order,
    active: r.active,
  }));

  // Preserve the kind order from the enum literal above for stable section order.
  const order: TransmissionServiceKind[] = [
    "allison_trans", "trans", "diff", "combined", "specialty_trans", "coolant_flush",
  ];
  const byKind = new Map<TransmissionServiceKind, TransmissionService[]>();
  for (const r of rows) {
    const arr = byKind.get(r.service_kind) ?? [];
    arr.push(r);
    byKind.set(r.service_kind, arr);
  }
  const groups = order
    .filter((k) => byKind.has(k))
    .map((kind) => ({
      kind,
      label: TRANSMISSION_KIND_LABEL[kind],
      rows: byKind.get(kind) ?? [],
    }));
  return { groups };
}

/**
 * Flat, searchable list of active Trans & Diff services for the package
 * builder's picker. Searches name + kind label.
 */
export async function listTransServicesForPicker(
  q?: string,
): Promise<TransmissionService[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transmission_services")
    .select("*, oil_types:oil_type_id(code, name)")
    .eq("active", true)
    .order("sort_order")
    .order("name")
    .limit(100);
  if (q && q.trim()) {
    const term = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(`name.ilike.${term},notes.ilike.${term}`);
  }
  const { data, error } = await query;
  if (error) throw error;

  type Row = Omit<TransmissionService, "oil_type_name"> & {
    oil_types: { code: string; name: string } | null;
  };
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    name: r.name,
    service_kind: r.service_kind,
    is_synthetic: r.is_synthetic,
    oil_type_id: r.oil_type_id,
    oil_type_name: r.oil_types ? excelOilLabel(r.oil_types.code, r.oil_types.name) : null,
    litres: r.litres,
    sell_price: Number(r.sell_price),
    labour: r.labour == null ? null : Number(r.labour),
    notes: r.notes,
    sort_order: r.sort_order,
    active: r.active,
  }));
}
