// MHSW (Ontario's Municipal Hazardous or Special Waste fee) — the shop charges
// it per oil/fuel filter and per litre of oil through two catalogue parts in
// the "MHSW" part category (QTL1010 = $1.50 per filter, QTL1011 = $0.06 per
// litre). The client's rule (call 2026-11-19, invoice notes 2026-11-20): MHSW
// works like HST, not like a part —
//   - it is not stock (no inventory, never blocks a sale for "not enough"),
//   - it is not "Total Parts" on the invoice, it totals on its own,
//   - MHSW paid on purchases vs MHSW charged on sales is reported like HST.
//
// The category is matched by name so the app works the same before and after
// migration 0164 (which also flags it `track_stock = false` in the database).

export const MHSW_CATEGORY_NAME = "MHSW";

export function isMhswCategoryName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === MHSW_CATEGORY_NAME.toLowerCase();
}
