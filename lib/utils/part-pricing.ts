import type { Part, PartMarginType } from "@/lib/db/types";

type PartPriceInputs = {
  cost: number;
  mhsw_fee: number;
  margin_type: PartMarginType;
  margin_value: number;
};

function toFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clampNonNegative(value: number): number {
  return Math.max(toFiniteNumber(value), 0);
}

function roundMoney(value: number): number {
  const rounded = Math.round(toFiniteNumber(value) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Margin amount. Sell MHSW is folded into the cost basis FIRST, then the
 * margin is calculated on that combined basis (cost + Sell MHSW). For a percent
 * margin this means MHSW is marked up too; for a fixed margin the basis is
 * irrelevant. See `calculatePartListPrice` for the full chain.
 */
export function calculatePartMarginAmount({
  cost,
  mhsw_fee,
  margin_type,
  margin_value,
}: Pick<PartPriceInputs, "cost" | "mhsw_fee" | "margin_type" | "margin_value">): number {
  const costBasis = toFiniteNumber(cost) + toFiniteNumber(mhsw_fee);
  const safeMarginValue = clampNonNegative(margin_value);
  return roundMoney(
    margin_type === "percent"
      ? (costBasis * safeMarginValue) / 100
      : safeMarginValue,
  );
}

/**
 * List price = (cost + Sell MHSW) + margin, where margin is computed on the
 * combined cost basis. Mirror of the `set_part_list_price()` DB trigger.
 */
export function calculatePartListPrice(input: PartPriceInputs): number {
  return roundMoney(
    toFiniteNumber(input.cost) +
      toFiniteNumber(input.mhsw_fee) +
      calculatePartMarginAmount(input),
  );
}

export function normalizePartPricing<T extends Pick<Part, "cost" | "mhsw_fee" | "margin_type" | "margin_value" | "list_price">>(
  part: T,
): T {
  const margin_value = roundMoney(clampNonNegative(part.margin_value));
  const list_price = calculatePartListPrice({
    cost: part.cost,
    mhsw_fee: part.mhsw_fee,
    margin_type: part.margin_type,
    margin_value,
  });

  return {
    ...part,
    margin_value,
    list_price,
  };
}
