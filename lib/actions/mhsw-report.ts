"use server";

// MHSW Summary — MHSW charged on sales vs MHSW paid on vendor bills, laid out
// like the HST summary (client call 2026-11-19: "the MHSW reporting will be
// exactly like the HST summary — what we paid on parts and what we received").
//
// Charged (sales): every line of a catalogue part in the "MHSW" category
// (QTL1010 per filter, QTL1011 per litre) at its line total, plus any Sell
// MHSW baked into a part's price (sales_job_items.mhsw_unit x qty).
// Paid (expenses): expense_items.mhsw_unit x qty (migration 0166).

import { createClient } from "@/lib/supabase/server";
import { fetchAllRowsParallel } from "@/lib/supabase/fetch-all";
import { requireProfile } from "@/lib/auth/require";
import { isPageAllowed } from "@/lib/permissions/check";
import { MHSW_CATEGORY_NAME } from "@/lib/utils/mhsw";
import { addMonthsISO, todayISO } from "@/lib/utils/tz";

export interface MhswSummaryFilter {
  from?: string;
  to?: string;
  location_id?: string;
}

export interface MhswSummary {
  from: string;
  to: string;
  period_label: string;
  mhsw_charged: number;
  mhsw_paid: number;
  net: number;
  /** False until migration 0166 adds expense_items.mhsw_unit. */
  paid_supported: boolean;
  by_month: { month: string; charged: number; paid: number }[];
  by_location: { location_name: string; charged: number; paid: number }[];
}

type LocJoin = { name: string | null } | { name: string | null }[] | null;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const round2 = (n: number) => Math.round(n * 100) / 100;

function isMissingColumn(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "42703" || /mhsw_unit/i.test(err?.message ?? "");
}

export async function getMhswSummary(filter: MhswSummaryFilter = {}): Promise<MhswSummary> {
  const profile = await requireProfile();
  if (!isPageAllowed(profile, "reports_mhsw")) throw new Error("Unauthorized");
  const supabase = await createClient();

  const to = filter.to ?? todayISO();
  const from = filter.from ?? addMonthsISO(to, -1);

  // The MHSW category's parts (QTL1010 / QTL1011 today).
  const { data: mhswParts, error: partsErr } = await supabase
    .from("parts")
    .select("id, part_categories:category_id!inner(name)")
    .ilike("part_categories.name", MHSW_CATEGORY_NAME);
  if (partsErr) throw partsErr;
  const mhswPartIds = (mhswParts ?? []).map((p) => p.id as string);

  type SaleItem = {
    id: string;
    quantity: number;
    line_total: number;
    mhsw_unit: number | null;
    is_customer_supplied: boolean | null;
    sales_jobs: { job_date: string; location_id: string; locations: LocJoin } | { job_date: string; location_id: string; locations: LocJoin }[] | null;
  };
  const saleSelect =
    "id, quantity, line_total, mhsw_unit, is_customer_supplied, sales_jobs:sales_job_id!inner(job_date, location_id, deactivated_at, locations:location_id(name))";

  const salesItems = (build: (q: ReturnType<typeof baseSales>) => ReturnType<typeof baseSales>) =>
    fetchAllRowsParallel<SaleItem>((lo, hi, count) =>
      build(baseSales(count)).order("id").range(lo, hi),
    );
  function baseSales(count?: "exact") {
    let q = supabase
      .from("sales_job_items")
      .select(saleSelect, { count })
      .is("sales_jobs.deactivated_at", null)
      .gte("sales_jobs.job_date", from)
      .lte("sales_jobs.job_date", to);
    if (filter.location_id) q = q.eq("sales_jobs.location_id", filter.location_id);
    return q;
  }

  type ExpItem = {
    id: string;
    quantity: number;
    mhsw_unit: number;
    expenses: { expense_date: string; location_id: string; locations: LocJoin } | { expense_date: string; location_id: string; locations: LocJoin }[] | null;
  };

  const [mhswLines, embeddedLines, expenseLines] = await Promise.all([
    mhswPartIds.length
      ? salesItems((q) => q.in("part_id", mhswPartIds))
      : Promise.resolve([] as SaleItem[]),
    // Parts with Sell MHSW inside their price (not the MHSW parts themselves).
    salesItems((q) => {
      let r = q.gt("mhsw_unit", 0);
      if (mhswPartIds.length) r = r.not("part_id", "in", `(${mhswPartIds.join(",")})`);
      return r;
    }),
    fetchAllRowsParallel<ExpItem>((lo, hi, count) => {
      let q = supabase
        .from("expense_items")
        .select(
          "id, quantity, mhsw_unit, expenses:expense_id!inner(expense_date, location_id, deactivated_at, locations:location_id(name))",
          { count },
        )
        .gt("mhsw_unit", 0)
        .is("expenses.deactivated_at", null)
        .gte("expenses.expense_date", from)
        .lte("expenses.expense_date", to);
      if (filter.location_id) q = q.eq("expenses.location_id", filter.location_id);
      return q.order("id").range(lo, hi);
    }).then(
      (rows) => ({ rows, supported: true }),
      (e: unknown) => {
        if (!isMissingColumn(e)) throw e;
        return { rows: [] as ExpItem[], supported: false };
      },
    ),
  ]);

  const monthMap = new Map<string, { charged: number; paid: number }>();
  const locMap = new Map<string, { charged: number; paid: number }>();
  const bump = (month: string, loc: string, field: "charged" | "paid", amt: number) => {
    if (!amt) return;
    const m = monthMap.get(month) ?? { charged: 0, paid: 0 };
    m[field] += amt;
    monthMap.set(month, m);
    const l = locMap.get(loc) ?? { charged: 0, paid: 0 };
    l[field] += amt;
    locMap.set(loc, l);
  };

  let charged = 0;
  for (const it of mhswLines) {
    const job = one(it.sales_jobs);
    if (!job) continue;
    const amt = Number(it.line_total) || 0;
    charged += amt;
    bump(job.job_date.slice(0, 7), one(job.locations)?.name ?? "—", "charged", amt);
  }
  for (const it of embeddedLines) {
    if (it.is_customer_supplied) continue;
    const job = one(it.sales_jobs);
    if (!job) continue;
    const sign = Number(it.line_total) < 0 ? -1 : 1;
    const amt = round2((Number(it.mhsw_unit) || 0) * (Number(it.quantity) || 0)) * sign;
    charged += amt;
    bump(job.job_date.slice(0, 7), one(job.locations)?.name ?? "—", "charged", amt);
  }

  let paid = 0;
  for (const it of expenseLines.rows) {
    const exp = one(it.expenses);
    if (!exp) continue;
    const amt = round2((Number(it.mhsw_unit) || 0) * (Number(it.quantity) || 0));
    paid += amt;
    bump(exp.expense_date.slice(0, 7), one(exp.locations)?.name ?? "—", "paid", amt);
  }

  return {
    from,
    to,
    period_label: `${from} → ${to}`,
    mhsw_charged: round2(charged),
    mhsw_paid: round2(paid),
    net: round2(charged - paid),
    paid_supported: expenseLines.supported,
    by_month: [...monthMap.entries()]
      .map(([month, v]) => ({ month, charged: round2(v.charged), paid: round2(v.paid) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    by_location: [...locMap.entries()]
      .map(([location_name, v]) => ({ location_name, charged: round2(v.charged), paid: round2(v.paid) }))
      .sort((a, b) => a.location_name.localeCompare(b.location_name)),
  };
}
