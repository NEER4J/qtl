import type { Part } from "@/lib/db/types";

// ============================================================================
// Per-part sell-price tiers — the With Service / Without Service / Over Counter
// (+ Customer Supplies) prices used by the All-Filter-Price page AND by the
// sales job part-add tier dialog. Kept in one place so both surfaces agree.
//
// Counter premium and customer-supplies labour are per-part (client 2026-06):
// a part's own value wins; NULL falls back to the global app_settings value.
// ============================================================================

export type PartSellTiers = {
  /** Installed price (cost + mhsw + service cost), or the per-part override. */
  with_service: number | null;
  /** Counter price incl. premium; 0 for bundled (in_package) parts. */
  without_service: number | null;
  /** Over-counter price; defaults to With Service when no override. */
  over_counter: number | null;
  /** Flat labour charged when the customer brings their own filter. */
  customer_supplies: number;
};

type TierPart = Pick<
  Part,
  | "cost"
  | "mhsw_fee"
  | "in_package"
  | "with_service_price"
  | "without_service_price"
  | "over_counter_price"
  | "counter_premium"
  | "customer_supplies_labour"
>;

/** Round positive prices to .99; anything ≤ 0 returns null (so "—" shows). */
function round99(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) - 0.01 : null;
}

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
  const partBase = Number(part.cost) + Number(part.mhsw_fee);
  const counterPremium = effectiveCounterPremium(part, globalCounterPremium);

  const computedWithSvc = round99(partBase + serviceCost);
  const withSvc =
    part.with_service_price != null
      ? Number(part.with_service_price)
      : computedWithSvc;

  // Bundled parts have no standalone "Without Service" price — the customer
  // pays for the package, not the part. Force to 0 regardless of any override.
  const withoutSvc = part.in_package
    ? 0
    : part.without_service_price != null
      ? Number(part.without_service_price)
      : round99(partBase + serviceCost + counterPremium);

  const overCounter =
    part.over_counter_price != null ? Number(part.over_counter_price) : withSvc;

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
