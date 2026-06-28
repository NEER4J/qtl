import type { PartPackage, PartPackageItemRow } from "@/lib/db/types";

/**
 * Compute the price this package item would charge today, using the live
 * catalogue: the per-item override (if any), otherwise the part list price,
 * otherwise the oil-type cost × litres.
 */
export function effectiveCatalogPriceForItem(item: PartPackageItemRow): number {
  if (item.unit_price != null) return Number(item.unit_price) || 0;

  if (item.transmission_service_id && item.transmission_service) {
    const s = item.transmission_service;
    const v = (Number(s.sell_price) || 0) + (Number(s.labour) || 0);
    return Number.isFinite(v) ? v : 0;
  }

  if (item.oil_type_id && item.oil_type) {
    const lpg = Number(item.oil_type.litres_per_gallon) || 4.546;
    const ratePerLitre =
      item.oil_container === "gallon"
        ? Number(item.oil_type.gallon_cost_per_litre) / lpg
        : Number(item.oil_type.bulk_cost_per_litre);
    const litres = Number(item.litres ?? 0);
    const v = ratePerLitre * litres;
    return Number.isFinite(v) ? v : 0;
  }

  // Packages charge the part's With Service price (cost + service charge),
  // precomputed server-side in fetchPackageItems. (client 2026-06-27 — was the
  // list/Over-the-Counter price.)
  if (item.part) return Number(item.part.with_service) || 0;
  return 0;
}

/** Locked snapshot wins when present; otherwise we fall back to live catalog. */
export function effectiveLockedPriceForItem(item: PartPackageItemRow): number {
  return item.locked_unit_price != null
    ? Number(item.locked_unit_price)
    : effectiveCatalogPriceForItem(item);
}

/** True iff the package has a lock_until that is today or in the future. */
export function isPartPackageLocked(pkg: Pick<PartPackage, "lock_until">): boolean {
  if (!pkg.lock_until) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${pkg.lock_until}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= today.getTime();
}

/** Quantity-weighted catalog total (parts + oil rows, no labor). */
export function packageCatalogItemsTotal(items: PartPackageItemRow[]): number {
  let total = 0;
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    total += effectiveCatalogPriceForItem(it) * qty;
  }
  return Math.round(total * 100) / 100;
}

/** Quantity-weighted locked total (parts + oil rows, no labor). */
export function packageLockedItemsTotal(items: PartPackageItemRow[]): number {
  let total = 0;
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    total += effectiveLockedPriceForItem(it) * qty;
  }
  return Math.round(total * 100) / 100;
}
