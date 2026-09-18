// Volume tier premium — the flat amount added to an oil job by how many litres
// it takes (Settings → Pricing → Volume tiers). One rule everywhere: the
// highest bracket whose min litres is at or below the litres, per oil type.
// Same as tierPremiumFor in lib/actions/pricing.ts (oil-change grid), `tierFor`
// in getOilDetail and the SQL oil_change_price().

export interface VolumeTierRow {
  oil_type_id: string;
  min_litres: number;
  premium: number;
}

/** The bracket that applies, or null when the litres are below every bracket. */
export function volumeTierFor(
  tiers: readonly VolumeTierRow[],
  oilTypeId: string,
  litres: number,
): VolumeTierRow | null {
  let best: VolumeTierRow | null = null;
  for (const t of tiers) {
    if (t.oil_type_id !== oilTypeId) continue;
    const min = Number(t.min_litres);
    if (min <= litres && (!best || min > Number(best.min_litres))) best = t;
  }
  return best;
}

/** The premium in dollars; 0 below the lowest bracket. */
export function volumeTierPremium(
  tiers: readonly VolumeTierRow[],
  oilTypeId: string,
  litres: number,
): number {
  return Number(volumeTierFor(tiers, oilTypeId, litres)?.premium ?? 0) || 0;
}
