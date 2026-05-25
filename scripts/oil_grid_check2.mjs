// Round 2: compute what the cost-up formula WOULD say for Detroit DD13/DD15/DD16
// × Delo 15W40, so we can compare against the current $415.99 / $497.99 override.
// Mirrors the formula in lib/actions/pricing.ts:getOilChangeGrid.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing env"); process.exit(1); }
const supa = createClient(url, key);

const detroitId = "348426cf-2f76-4861-9871-a243a53dbada"; // DD13/DD15/DD16 With Detroit Filter
const oilIds = [
  ["3842153a-e788-4528-9e2e-36f7861daba3", "Delo 400 XLE SB 15W40 (Chevron)"],
  ["6d1423e4-eb39-49df-9254-965b0a3311d7", "Shell T4 15W40"],
  ["9d91de56-1a26-47b4-a8bf-f096a51a925a", "Mobil 15W40"],
];

const { data: engine, error: eEng } = await supa
  .from("engine_types")
  .select("id, display_name, oil_capacity_litres")
  .eq("id", detroitId)
  .single();
if (eEng) { console.error("engine query:", eEng); process.exit(1); }

const { data: filters, error: eFil } = await supa
  .from("engine_filters")
  .select("quantity, parts:part_id(part_number, cost, mhsw_fee, service_costs:service_cost_id(name, cost))")
  .eq("engine_type_id", detroitId);
if (eFil) { console.error("filters query:", eFil); process.exit(1); }

let filterCost = 0;
let svcCost = 0;
for (const f of filters) {
  const qty = Number(f.quantity) || 0;
  filterCost += (Number(f.parts?.cost ?? 0) + Number(f.parts?.mhsw_fee ?? 0)) * qty;
  svcCost += Number(f.parts?.service_costs?.cost ?? 0) * qty;
}

const capL = Number(engine.oil_capacity_litres);
const round99 = (n) => Math.ceil(n) - 0.01;

console.log(`Engine: ${engine.display_name}  (capacity ${capL} L)`);
console.log(`  filter cost (+mhsw, qty-weighted): $${filterCost.toFixed(2)}`);
console.log(`  service cost (sum of parts' service_costs): $${svcCost.toFixed(2)}`);
console.log("");

for (const [oilId, label] of oilIds) {
  const { data: oil } = await supa
    .from("oil_types")
    .select("id, code, name, bulk_cost_per_litre, gallon_cost_per_litre, litres_per_gallon")
    .eq("id", oilId)
    .single();

  const { data: tiers } = await supa
    .from("volume_tiers")
    .select("min_litres, premium")
    .eq("oil_type_id", oilId);

  let tier = 0;
  let bestMin = -1;
  for (const t of tiers ?? []) {
    if (Number(t.min_litres) <= capL && Number(t.min_litres) > bestMin) {
      bestMin = Number(t.min_litres);
      tier = Number(t.premium);
    }
  }

  const lpg = Number(oil.litres_per_gallon);
  const bulkRate = Number(oil.bulk_cost_per_litre);
  const gallonRate = lpg > 0 ? Number(oil.gallon_cost_per_litre) / lpg : NaN;

  const bulk = round99(bulkRate * capL + filterCost + svcCost + tier);
  const gallon = round99(gallonRate * capL + filterCost + svcCost + tier);

  // Current override
  const { data: ov } = await supa
    .from("engine_sell_prices")
    .select("container, sell_price")
    .eq("engine_type_id", detroitId)
    .eq("oil_type_id", oilId);

  const ovBulk = ov?.find((x) => x.container === "bulk")?.sell_price ?? null;
  const ovGal  = ov?.find((x) => x.container === "gallon")?.sell_price ?? null;

  console.log(`${label}`);
  console.log(`  oil bulk/L=${bulkRate}  gallon/L=${gallonRate?.toFixed?.(4) ?? "n/a"}  tier=${tier}`);
  console.log(`  COMPUTED  bulk=$${bulk}  gallon=$${gallon}`);
  console.log(`  OVERRIDE  bulk=$${ovBulk}  gallon=$${ovGal}`);
  console.log("");
}
