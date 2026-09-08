import type { Part } from "@/lib/db/types";
import { roundUpTo99 } from "@/lib/utils/format";

// ============================================================================
// Per-part sell-price tiers — the With Service / Without Service / Over the
// Counter (+ Customer Supplies) prices used by the All-Filter-Price page AND by
// the sales job part-add tier dialog. Kept in one place so both surfaces agree.
//
// Pricing model (client 2026-06):
//   * Over the Counter = List price (cost + Sell MHSW + margin).
//   * With Service     = Total cost + Service charge.
//                        (Total cost = part.cost, which already includes Buy
//                        MHSW. "Service charge" is the per-part counter_premium
//                        column, relabelled — it may be NEGATIVE.)
//   * Without Service  = Linked labour charge + List price.
//   * Customer Supplies = flat labour fee (unchanged).
//
// A part flagged `in_package` prices at With Service = $0 on ONE surface only —
// the sales job tier dialog — via `bundledWithServiceIsFree`. (The 0059 column
// comment says the flag zeroes *Without* Service; it never has in this code.)
//
// Service charge and customer-supplies labour are per-part: a part's own value
// wins; NULL falls back to the global app_settings value. Each tier also keeps
// an optional per-part override column which, when set, wins over the formula.
// ============================================================================

export type PartSellTiers = {
  /** Total cost + Service charge, or the per-part override. */
  with_service: number | null;
  /** Linked labour + List price, or the per-part override. */
  without_service: number | null;
  /** List price (= Over the Counter), or the per-part override. */
  over_counter: number | null;
  /** Flat labour charged when the customer brings their own filter (the primary value). */
  customer_supplies: number;
  /** Optional LIST of customer-supplies labour options; empty = just the single value above. */
  customer_supplies_options: number[];
};

type TierPart = Pick<
  Part,
  | "cost"
  | "mhsw_fee"
  | "list_price"
  | "in_package"
  | "with_service_price"
  | "without_service_price"
  | "over_counter_price"
  | "counter_premium"
  | "customer_supplies_labour"
  | "customer_supplies_labour_options"
  | "round_off"
>;

/** Round to 2 decimals; anything ≤ 0 returns null (so "—" shows). */
function round2(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// "Service charge" is the relabelled per-part counter_premium. It may be
// negative, so this can return a negative number.
export function effectiveCounterPremium(
  part: Pick<Part, "counter_premium">,
  globalCounterPremium: number,
): number {
  return part.counter_premium != null
    ? Number(part.counter_premium)
    : globalCounterPremium;
}

export function effectiveCustomerSuppliesLabour(
  part: Pick<Part, "customer_supplies_labour">,
  globalCustomerSuppliesLabour: number,
): number {
  return part.customer_supplies_labour != null
    ? Number(part.customer_supplies_labour)
    : globalCustomerSuppliesLabour;
}

/** The list of customer-supplies labour options for a part: the per-part list
 *  when set, otherwise the single primary value. Always ≥ 1 entry. */
export function effectiveCustomerSuppliesOptions(
  part: Pick<Part, "customer_supplies_labour" | "customer_supplies_labour_options">,
  globalCustomerSuppliesLabour: number,
): number[] {
  const list = (part.customer_supplies_labour_options ?? [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  return list.length > 0
    ? list
    : [effectiveCustomerSuppliesLabour(part, globalCustomerSuppliesLabour)];
}

/** The one rule that is NOT the same on every surface — see `withSvc` below. */
export type PartSellTierOptions = {
  /**
   * When true, a part flagged `in_package` prices at With Service = $0: its
   * package already covers it, so adding it individually to that job must not
   * charge for it a second time. ONLY the sales job part-add tier dialog sets
   * this. Reference surfaces (the All-filter-sell-price list, the part editor's
   * "Calculated …" placeholder) leave it off and show the real formula price.
   */
  bundledWithServiceIsFree?: boolean;
};

export function computePartSellTiers(
  part: TierPart,
  serviceCost: number,
  globalCounterPremium: number,
  globalCustomerSuppliesLabour: number,
  opts: PartSellTierOptions = {},
): PartSellTiers {
  // "Cost price" = base cost (incl Buy MHSW) + Sell MHSW — the SAME basis the
  // list price is built on (cost + Sell MHSW + margin). With Service is computed
  // off this cost price, so Sell MHSW must be folded in here too. (client
  // 2026-06-28 — previously used bare part.cost, which dropped the Sell MHSW.)
  const totalCost = Number(part.cost) + Number(part.mhsw_fee);
  const listPrice = Number(part.list_price);
  const serviceCharge = effectiveCounterPremium(part, globalCounterPremium);

  // Over the Counter = List price.
  const overCounter =
    part.over_counter_price != null
      ? Number(part.over_counter_price)
      : round2(listPrice);

  // With Service = Total cost + Service charge.
  //
  // The $0-for-bundled rule is now opt-in (`bundledWithServiceIsFree`) instead
  // of unconditional. It belongs to ONE surface — adding a bundled part
  // individually to a sales job, where the package has already covered it
  // (client 2026-07-16: "with service should become zero when the bundle option
  // is on"). Applying it everywhere zeroed the With Service column for all 80
  // active in_package parts on the All-filter-sell-price list and made the part
  // editor offer "Calculated $0.00", so a filter with a real cost and service
  // charge looked like it had no With Service price at all — e.g. FF252
  // ($45.48 cost + $10 per-part service charge, shown as $0.00). (client
  // 2026-09-08 — "FF252, FF4212800MX, FF5206 not calculating with service
  // price".) The reference surfaces now show the formula price; only the job
  // tier dialog zeroes a bundled part.
  //
  // The service charge may be negative enough to make the WHOLE result negative
  // (e.g. cost $20, service charge -$40 -> -$20) — that is INTENTIONAL (client
  // 2026-07-16: "if you put a negative number it is not calculating" — a prior
  // `Math.max(0, …)` floor was silently clamping a legitimately negative result
  // to $0; removed). A per-part override still wins for NON-bundled parts.
  const withSvc =
    opts.bundledWithServiceIsFree && part.in_package
      ? 0
      : part.with_service_price != null
        ? Number(part.with_service_price)
        : Math.round((totalCost + serviceCharge) * 100) / 100;

  // Without Service = Linked labour charge + List price.
  const withoutSvc =
    part.without_service_price != null
      ? Number(part.without_service_price)
      : round2(serviceCost + listPrice);

  // Per-part opt-in: when `round_off` is ticked, snap every sell tier up to the
  // next .99 — at the SOURCE, so the tier dialog, the All-filter-sell-price
  // list, and the sales line all show the same rounded price. (client 2026-07-16
  // — "round off checked but not working in many cases": it only rounded at
  // line-add before, so the dialog / price lists still showed non-.99.)
  const snap = (n: number | null): number | null =>
    n != null && part.round_off ? roundUpTo99(n) : n;

  return {
    with_service: snap(withSvc),
    without_service: snap(withoutSvc),
    over_counter: snap(overCounter),
    customer_supplies: effectiveCustomerSuppliesLabour(
      part,
      globalCustomerSuppliesLabour,
    ),
    customer_supplies_options: effectiveCustomerSuppliesOptions(
      part,
      globalCustomerSuppliesLabour,
    ),
  };
}
