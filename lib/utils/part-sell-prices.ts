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
//   * Without Service  = Linked labour charge + List price. Bundled parts → 0.
//   * Customer Supplies = flat labour fee (unchanged).
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

export function computePartSellTiers(
  part: TierPart,
  serviceCost: number,
  globalCounterPremium: number,
  globalCustomerSuppliesLabour: number,
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

  // With Service = Total cost + Service charge. BUT a part flagged as bundled
  // (in_package) is already covered by its package, so when it's added
  // individually to a job its With Service price is $0. (client 2026-07-16 —
  // "with service should become zero when the bundle option is on"; this rule
  // was dropped during the package-pricing rework and is restored here. Without
  // Service / Over the Counter still charge — only With Service goes to 0.)
  // The service charge may be negative enough to make the WHOLE result negative
  // (e.g. cost $20, service charge -$40 -> -$20) — that is INTENTIONAL (client
  // 2026-07-16: "if you put a negative number it is not calculating" — a prior
  // `Math.max(0, …)` floor was silently clamping a legitimately negative result
  // to $0; removed). A per-part override still wins for NON-bundled parts.
  const withSvc = part.in_package
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
