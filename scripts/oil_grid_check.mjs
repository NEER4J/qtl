// Read-only diagnostic for the "Detroit DD13/DD15/DD16 With Detroit Filter
// shows Chevron pricing in 15W40" bug. Run from the project root:
//   set -a; . ./.env.local; set +a; node scripts/oil_grid_check.mjs
// Reads engine_types, oil_types, engine_sell_prices, engine_filters only.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supa = createClient(url, key);

// 1. Engines whose display_name mentions Detroit
const { data: engines, error: e1 } = await supa
  .from("engine_types")
  .select("id, manufacturer, model, display_name, active, sort_order")
  .ilike("display_name", "%detroit%")
  .order("display_name");
if (e1) { console.error(e1); process.exit(1); }
console.log("== Engines with 'detroit' in display_name ==");
for (const r of engines) {
  console.log(`  ${r.id}  ${r.display_name}  (active=${r.active})`);
}

// 2. 15W40 oil types
const { data: oils, error: e2 } = await supa
  .from("oil_types")
  .select("id, code, name, is_base, bulk_cost_per_litre, gallon_cost_per_litre")
  .or("code.ilike.%15W40%,name.ilike.%15W40%");
if (e2) { console.error(e2); process.exit(1); }
console.log("\n== Oil types matching 15W40 ==");
for (const r of oils) {
  console.log(`  ${r.id}  ${r.code}  ${r.name}  base=${r.is_base}  bulk=${r.bulk_cost_per_litre}  gallon=${r.gallon_cost_per_litre}`);
}

const detroitFilterIds = engines
  .filter((e) => /Detroit Filter/i.test(e.display_name))
  .map((e) => e.id);
const oil15w40Ids = oils.map((o) => o.id);

// 3. engine_sell_prices for Detroit-filter × 15W40
if (detroitFilterIds.length && oil15w40Ids.length) {
  const { data: prices, error: e3 } = await supa
    .from("engine_sell_prices")
    .select("*, oil_types:oil_type_id(code, name), engine_types:engine_type_id(display_name)")
    .in("engine_type_id", detroitFilterIds)
    .in("oil_type_id", oil15w40Ids);
  if (e3) { console.error(e3); process.exit(1); }
  console.log("\n== engine_sell_prices for Detroit-filter × 15W40 ==");
  if (prices.length === 0) console.log("  (no rows)");
  for (const r of prices) {
    console.log(`  engine=${r.engine_types?.display_name}  oil=${r.oil_types?.code}  container=${r.container}  sell_price=${r.sell_price}`);
  }
} else {
  console.log("\n(no Detroit-filter engines or no 15W40 oil types found — skipping price comparison)");
}

// 4. Same on Chevron-filter rows for comparison
const { data: chevPrices, error: e4 } = await supa
  .from("engine_sell_prices")
  .select("*, oil_types:oil_type_id(code), engine_types:engine_type_id(display_name)")
  .in("oil_type_id", oil15w40Ids);
if (e4) { console.error(e4); process.exit(1); }
const chevHits = chevPrices.filter((p) => /chevron/i.test(p.engine_types?.display_name || ""));
console.log("\n== 15W40 prices on Chevron-filter engines (for comparison) ==");
if (chevHits.length === 0) console.log("  (no rows)");
for (const r of chevHits.slice(0, 30)) {
  console.log(`  engine=${r.engine_types?.display_name}  container=${r.container}  sell_price=${r.sell_price}`);
}

// 5. Which parts are linked to the Detroit-filter engines?
if (detroitFilterIds.length) {
  const { data: filters, error: e5 } = await supa
    .from("engine_filters")
    .select("engine_type_id, quantity, parts:part_id(part_number, brand, cost, mhsw_fee, service_cost_id), engine_types:engine_type_id(display_name)")
    .in("engine_type_id", detroitFilterIds);
  if (e5) { console.error(e5); process.exit(1); }
  console.log("\n== engine_filters on Detroit-filter engines ==");
  if (filters.length === 0) console.log("  (no rows)");
  for (const r of filters) {
    console.log(`  engine=${r.engine_types?.display_name}  qty=${r.quantity}  part=${r.parts?.brand} ${r.parts?.part_number}  cost=${r.parts?.cost}  mhsw=${r.parts?.mhsw_fee}`);
  }
}
