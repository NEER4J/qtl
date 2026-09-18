// Lines the sales form adds and keeps up to date by itself (client 2026-09-15):
//
//   * oil_tier_premium — ONE "Volume tier premium" line per job: for each oil on
//     the job, the tier premium for that oil's total litres. "Add oil" used to
//     charge litres × rate only, while the oil-change price list adds the tier.
//   * grease_only_fee — the fee from Settings → Pricing defaults when a job is
//     only greasing: no oil, filters, fuel or Trans & Diff. Not charged on a
//     free-grease redemption.
//
// Rules shared by both:
//   * the form reconciles only when staff change the lines (or the free-grease
//     tick) — never just because a job was opened, so old invoices don't move;
//   * editing or deleting an automatic line hands it over to the staff member:
//     the job's waived flag is set and that charge is left alone until they
//     choose "Add it back";
//   * automatic lines carry no part_id / oil_type_id, so stock, the package
//     overlap check and reports never mistake them for a part or an oil.
//
// Plain module (no "use server") — the form runs this in the browser.

import type { CostBucket } from "@/lib/utils/cost-bucket";
import { volumeTierFor, type VolumeTierRow } from "@/lib/utils/oil-tier";

export type AutoFee = "oil_tier_premium" | "grease_only_fee";
export type AutoFeeWaivers = Record<AutoFee, boolean>;

/** The fields of a sales line this module reads and writes. */
export interface AutoLineItem {
  key: string;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  is_taxable: boolean;
  package_group?: string | null;
  is_customer_supplied?: boolean;
  part_category_id?: string | null;
  oil_type_id?: string | null;
  oil_container?: "bulk" | "gallon" | null;
  transmission_service_id?: string | null;
  auto_fee?: AutoFee | null;
}

export interface AutoLineContext {
  oilTypes: readonly { id: string; name: string; litres_per_gallon: number }[];
  tiers: readonly VolumeTierRow[];
  /** app_settings.grease_only_fee; 0 turns the fee off. */
  greaseOnlyFee: number;
  freeGreaseApplied: boolean;
  waived: AutoFeeWaivers;
  /** Cost bucket of a part category (costBucketFor on the category). */
  bucketOf: (categoryId: string | null | undefined) => CostBucket;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtLitres = (n: number) => `${Number(n.toFixed(2))} L`;

/**
 * Litres of each oil on the job that the tier is priced on: standalone oil
 * lines only. Package oil is priced by its package, returns and customer-
 * supplied oil aren't sold, and a gallon line counts jugs × that oil's jug size.
 * A saved line from before 0149 has no container and counts as litres, which is
 * what it was.
 */
export function oilLitresByType(
  items: readonly AutoLineItem[],
  oilTypes: AutoLineContext["oilTypes"],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    if (!it.oil_type_id || it.package_group || it.auto_fee || it.is_customer_supplied) continue;
    if (Number(it.unit_price) < 0) continue;
    const qty = Number(it.quantity) || 0;
    if (qty <= 0) continue;
    let litres = qty;
    if (it.oil_container === "gallon") {
      const lpg = Number(oilTypes.find((o) => o.id === it.oil_type_id)?.litres_per_gallon);
      litres = qty * (lpg > 0 ? lpg : 1);
    }
    out.set(it.oil_type_id, (out.get(it.oil_type_id) ?? 0) + litres);
  }
  return out;
}

/** The premium line this job should carry, or null when no oil reaches a tier. */
export function tierPremiumFor(
  items: readonly AutoLineItem[],
  ctx: Pick<AutoLineContext, "oilTypes" | "tiers">,
): { amount: number; description: string } | null {
  const parts: string[] = [];
  let amount = 0;
  for (const [oilTypeId, litres] of oilLitresByType(items, ctx.oilTypes)) {
    const tier = volumeTierFor(ctx.tiers, oilTypeId, litres);
    const premium = Number(tier?.premium ?? 0) || 0;
    if (!tier || premium <= 0) continue;
    amount += premium;
    const name = ctx.oilTypes.find((o) => o.id === oilTypeId)?.name ?? "Oil";
    parts.push(`${name} ${fmtLitres(litres)} (${Number(tier.min_litres)} L+ tier)`);
  }
  if (amount <= 0) return null;
  return { amount: round2(amount), description: `Volume tier premium — ${parts.join("; ")}` };
}

/**
 * A grease-only job: at least one line in a Grease category, and nothing that
 * makes it a bigger job — no oil line, no Trans & Diff service, no part in a
 * Filter, Oil or Fuel category. Labour, other parts, custom lines, promotions,
 * returns and the automatic lines themselves don't count either way.
 */
export function isGreaseOnlyJob(
  items: readonly AutoLineItem[],
  bucketOf: AutoLineContext["bucketOf"],
): boolean {
  let grease = false;
  for (const it of items) {
    if (it.auto_fee) continue;
    if (Number(it.unit_price) < 0) continue;
    if (it.oil_type_id || it.transmission_service_id) return false;
    if (!it.part_category_id) continue;
    const bucket = bucketOf(it.part_category_id);
    if (bucket === "grease") grease = true;
    else if (bucket === "filter" || bucket === "oil" || bucket === "fuel") return false;
  }
  return grease;
}

export const GREASE_ONLY_FEE_DESCRIPTION = "Grease-only service fee";

/** What each automatic charge WOULD be right now, ignoring waivers. */
export function autoCharges(
  items: readonly AutoLineItem[],
  ctx: AutoLineContext,
): Record<AutoFee, { amount: number; description: string } | null> {
  const fee = Number(ctx.greaseOnlyFee) || 0;
  return {
    oil_tier_premium: tierPremiumFor(items, ctx),
    grease_only_fee:
      fee > 0 && !ctx.freeGreaseApplied && isGreaseOnlyJob(items, ctx.bucketOf)
        ? { amount: round2(fee), description: GREASE_ONLY_FEE_DESCRIPTION }
        : null,
  };
}

/**
 * Brings the automatic lines in line with the rest of the job. An existing
 * automatic line keeps its key (and its tax tick) and just gets the new amount;
 * one that no longer applies is removed; a new one goes at the end. A waived
 * charge is left exactly as staff left it.
 */
export function reconcileAutoLines<T extends AutoLineItem>(
  items: readonly T[],
  ctx: AutoLineContext,
  makeLine: (partial: Partial<T>) => T,
): T[] {
  const charges = autoCharges(items, ctx);
  let next: T[] = [...items];
  for (const kind of ["oil_tier_premium", "grease_only_fee"] as const) {
    if (ctx.waived[kind]) continue;
    const want = charges[kind];
    const existing = next.find((it) => it.auto_fee === kind);
    if (!want) {
      if (existing) next = next.filter((it) => it !== existing);
      continue;
    }
    if (existing) {
      if (
        Number(existing.unit_price) !== want.amount ||
        existing.description !== want.description ||
        Number(existing.quantity) !== 1
      ) {
        next = next.map((it) =>
          it === existing
            ? { ...it, unit_price: want.amount, description: want.description, quantity: 1 }
            : it,
        );
      }
      continue;
    }
    next = [
      ...next,
      makeLine({
        part_id: null,
        description: want.description,
        quantity: 1,
        unit_price: want.amount,
        is_taxable: true,
        auto_fee: kind,
      } as Partial<T>),
    ];
  }
  return next;
}
