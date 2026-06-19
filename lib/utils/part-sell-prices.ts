import type { Part } from "@/lib/db/types";

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
  /** Total cost + Service charge; 0 for bundled (in_package) parts; or the per-part override. */
  with_service: number | null;
  /** Linked labour + List price, or the per-part override. */
  without_service: number | null;
  /** List price (= Over the Counter), or the per-part override. */
  over_counter: number | null;
  /** Flat labour charged when the customer brings their own filter. */
  customer_supplies: number;
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

export function computePartSellTiers(
  part: TierPart,
  serviceCost: number,
  globalCounterPremium: number,
  globalCustomerSuppliesLabour: number,
): PartSellTiers {
  const totalCost = Number(part.cost); // already includes Buy MHSW
  const listPrice = Number(part.list_price);
  const serviceCharge = effectiveCounterPremium(part, globalCounterPremium);

  // Over the Counter = List price.
  const overCounter =
    part.over_counter_price != null
      ? Number(part.over_counter_price)
      : round2(listPrice);

  // With Service = Total cost + Service charge. Bundled parts have no standalone
  // installed price (the customer pays for the package) → force 0. Otherwise the
  // Service charge may be negative (a discount), so floor at 0 and ALWAYS return
  // a number (never null it out, which used to hide the tier on a big negative).
  // A per-part override still wins.
  const withSvc = part.in_package
    ? 0
    : part.with_service_price != null
      ? Number(part.with_service_price)
      : Math.max(0, Math.round((totalCost + serviceCharge) * 100) / 100);

  // Without Service = Linked labour charge + List price.
  const withoutSvc =
    part.without_service_price != null
      ? Number(part.without_service_price)
      : round2(serviceCost + listPrice);

  return {
    with_service: withSvc,
    without_service: withoutSvc,
    over_counter: overCounter,
    customer_supplies: effectiveCustomerSuppliesLabour(
      part,
      globalCustomerSuppliesLabour,
    ),
  };
}
