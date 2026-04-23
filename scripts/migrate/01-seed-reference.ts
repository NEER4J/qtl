// 01-seed-reference.ts
// Idempotently ensure the baseline reference rows exist — locations, service
// types, expense categories, subcategories. `supabase/seed.sql` already does
// this on `supabase db reset`; this step covers the "import into an existing
// remote database" case and is safe to rerun.

import { bumpInserted } from "./utils/report";
import type { Step, StepContext } from "./utils/step";

const LOCATIONS: Array<{ code: string; name: string }> = [
  { code: "AYR", name: "Ayr" },
  { code: "FE",  name: "Fort Erie" },
  { code: "NP",  name: "Napanee" },
];

const SERVICE_TYPES: Array<{ code: "OC"|"PG"|"FG"|"MISC"; name: string; sort: number }> = [
  { code: "OC",   name: "Oil Change",  sort: 1 },
  { code: "PG",   name: "Pit Grease",  sort: 2 },
  { code: "FG",   name: "Full Grease", sort: 3 },
  { code: "MISC", name: "Misc",        sort: 4 },
];

const EXPENSE_CATEGORIES: Array<{ name: string; sort: number }> = [
  { name: "Advertisement", sort: 1 },
  { name: "Cleaning",      sort: 2 },
  { name: "Repair",        sort: 3 },
  { name: "Utility",       sort: 4 },
  { name: "Misc",          sort: 5 },
  { name: "Bank",          sort: 6 },
  { name: "Purchase",      sort: 7 },
  { name: "Others",        sort: 8 },
];

const EXPENSE_SUBCATEGORIES: Array<{ category: string; name: string; sort: number }> = [
  { category: "Advertisement", name: "Radio",                    sort: 1 },
  { category: "Advertisement", name: "Truck Show",               sort: 2 },
  { category: "Advertisement", name: "IT/Digital",               sort: 3 },
  { category: "Advertisement", name: "Graphic Design",           sort: 4 },
  { category: "Cleaning",      name: "Grass Cutting/Snow Removal", sort: 1 },
  { category: "Cleaning",      name: "Uniform",                  sort: 2 },
  { category: "Repair",        name: "Door",                     sort: 1 },
  { category: "Repair",        name: "Equipment",                sort: 2 },
  { category: "Repair",        name: "Plugs",                    sort: 3 },
  { category: "Utility",       name: "Electricity",              sort: 1 },
  { category: "Utility",       name: "Heating",                  sort: 2 },
  { category: "Utility",       name: "Alarm",                    sort: 3 },
  { category: "Misc",          name: "Insurance",                sort: 1 },
  { category: "Misc",          name: "Land Lease",               sort: 2 },
  { category: "Misc",          name: "Pro Tax",                  sort: 3 },
  { category: "Misc",          name: "Phone",                    sort: 4 },
  { category: "Misc",          name: "Internet",                 sort: 5 },
  { category: "Misc",          name: "Fuel",                     sort: 6 },
  { category: "Misc",          name: "Legal Fee",                sort: 7 },
  { category: "Misc",          name: "Accountant Fee",           sort: 8 },
  { category: "Misc",          name: "Official Exp",             sort: 9 },
  { category: "Bank",          name: "Loan Interest",            sort: 1 },
  { category: "Bank",          name: "Credit Card Cost",         sort: 2 },
  { category: "Purchase",      name: "Filter",                   sort: 1 },
  { category: "Purchase",      name: "Oil",                      sort: 2 },
  { category: "Purchase",      name: "Supply",                   sort: 3 },
];

async function run(ctx: StepContext): Promise<void> {
  const { sql, report } = ctx;

  for (const l of LOCATIONS) {
    const rows = await sql`
      insert into public.locations (code, name, active)
      values (${l.code}, ${l.name}, true)
      on conflict (code) do nothing
      returning id
    `;
    if (rows.length > 0) bumpInserted(report, "locations");
  }

  for (const s of SERVICE_TYPES) {
    const rows = await sql`
      insert into public.service_types (code, name, sort_order, active)
      values (${s.code}::service_code, ${s.name}, ${s.sort}, true)
      on conflict (code) do nothing
      returning id
    `;
    if (rows.length > 0) bumpInserted(report, "service_types");
  }

  for (const c of EXPENSE_CATEGORIES) {
    const rows = await sql`
      insert into public.expense_categories (name, sort_order, active)
      values (${c.name}, ${c.sort}, true)
      on conflict (name) do nothing
      returning id
    `;
    if (rows.length > 0) bumpInserted(report, "expense_categories");
  }

  for (const s of EXPENSE_SUBCATEGORIES) {
    const rows = await sql`
      insert into public.expense_subcategories (category_id, name, sort_order, active)
      select c.id, ${s.name}, ${s.sort}, true
        from public.expense_categories c
       where c.name = ${s.category}
      on conflict (category_id, name) do nothing
      returning id
    `;
    if (rows.length > 0) bumpInserted(report, "expense_subcategories");
  }
}

export const step: Step = { name: "seed-reference", run };
