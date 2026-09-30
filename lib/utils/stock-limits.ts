// Min / max stock thresholds are per location (migration 0151): each shop
// reorders for itself, so a count is compared with its own shop's thresholds,
// never with the total across shops.

export interface StockLimit {
  /** Reorder point at this location; null = not set. */
  min: number | null;
  /** Overstock ceiling at this location; null = not set. */
  max: number | null;
}

export const NO_LIMIT: StockLimit = { min: null, max: null };

export type StockStatus = "low" | "over" | null;

export function stockStatus(qty: number, limit: StockLimit | undefined): StockStatus {
  if (!limit) return null;
  if (limit.min != null && qty < limit.min) return "low";
  if (limit.max != null && qty > limit.max) return "over";
  return null;
}

type StockRow = {
  qtyByLocation: Record<string, number>;
  limitsByLocation: Record<string, StockLimit>;
};

/** Ids of the locations where this row is in the given state. */
export function locationsWithStatus(row: StockRow, status: "low" | "over"): string[] {
  return Object.keys(row.limitsByLocation).filter(
    (locId) => stockStatus(row.qtyByLocation[locId] ?? 0, row.limitsByLocation[locId]) === status,
  );
}

/** Below its minimum at one location or more. */
export function isLowAnywhere(row: StockRow): boolean {
  return locationsWithStatus(row, "low").length > 0;
}
