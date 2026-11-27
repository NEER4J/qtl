// Lines the sales form adds and keeps up to date by itself (client 2026-09-15):
//
//   * oil_tier_premium — ONE "Volume tier premium" line per job: for each oil on
//     the job, the tier premium for that oil's total litres. "Add oil" used to
//     charge litres × rate only, while the oil-change price list adds the tier.
//   * grease_only_fee — the fee from Settings → Pricing defaults when a job is
//     only greasing: no oil, filters, fuel or Trans & Diff. Not charged on a
//     free-grease redemption.
//   * mhsw_parts — "MHSW — parts": the Sell MHSW of every part sold on the job
//     (mhsw_unit × quantity). MHSW is no longer inside part prices (client
//     2026-11-25, 0169).
//   * mhsw_oil — "MHSW — bulk oil": bulk litres × app_settings
//     .mhsw_oil_per_litre (6¢/L).
//
// The tier of an oil change's oil is priced on the engine's capacity at most
// (tierCaps), so selling extra oil never moves it (client 2026-11-03).
//
// Rules shared by all of them:
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

export type AutoFee = "oil_tier_premium" | "grease_only_fee" | "mhsw_parts" | "mhsw_oil";
/** Every automatic charge, in the order its line is added. */
export const AUTO_FEES: readonly AutoFee[] = ["oil_tier_premium", "grease_only_fee", "mhsw_parts", "mhsw_oil"];
/** What staff see the charge called. */
export const AUTO_FEE_LABEL: Record<AutoFee, string> = {
  oil_tier_premium: "Volume tier premium",
  grease_only_fee: "Grease-only service fee",
  mhsw_parts: "MHSW on parts",
  mhsw_oil: "MHSW on bulk oil",
};
/** Where the amount comes from, under the line on the job form. */
export const AUTO_FEE_SOURCE: Record<AutoFee, string> = {
  oil_tier_premium:
    "from the oil on this job (Volume tiers) — the job and invoice show it with the oil as one line",
  grease_only_fee: "— grease-only job (Pricing defaults)",
  mhsw_parts: "— each part's Sell MHSW × quantity (Parts)",
  mhsw_oil: "— bulk oil litres × the MHSW per litre (Pricing defaults)",
};
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
  /** Oil beyond the engine's capacity, sold at the retail rate (0157). */
  is_extra_oil?: boolean;
  /** Per-unit Sell MHSW of the linked part (0083; charged on its own line since 0169). */
  mhsw_unit?: number;
  /** Set on a merged duplicate billed at $0. */
  merged_unit_price?: number | null;
}

export interface AutoLineContext {
  oilTypes: readonly { id: string; name: string; litres_per_gallon: number }[];
  tiers: readonly VolumeTierRow[];
  /**
   * Litres an oil's tier is never priced above: the engine's capacity, for the
   * oil of an oil change. Extra oil (or a gallon count rounded up past the
   * capacity) must not move the tier — the price list prices it at capacity.
   */
  tierCaps?: ReadonlyMap<string, number>;
  /** app_settings.grease_only_fee; 0 turns the fee off. */
  greaseOnlyFee: number;
  freeGreaseApplied: boolean;
  /** app_settings.mhsw_oil_per_litre — MHSW per litre of bulk oil; 0 turns it off. */
  mhswOilPerLitre: number;
  waived: AutoFeeWaivers;
  /** Cost bucket of a part category (costBucketFor on the category). */
  bucketOf: (categoryId: string | null | undefined) => CostBucket;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtLitres = (n: number) => `${Number(n.toFixed(2))} L`;

/**
 * Litres of each oil on the job that the tier is priced on: standalone oil
 * lines only. Package oil is priced by its package, returns and customer-
 * supplied oil aren't sold, extra oil past the engine's capacity is a retail
 * sale, and a gallon line counts jugs × that oil's jug size.
 * A saved line from before 0149 has no container and counts as litres, which is
 * what it was.
 */
export function oilLitresByType(
  items: readonly AutoLineItem[],
  oilTypes: AutoLineContext["oilTypes"],
  caps?: AutoLineContext["tierCaps"],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    if (!it.oil_type_id || it.package_group || it.auto_fee || it.is_customer_supplied) continue;
    if (it.is_extra_oil) continue;
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
  if (caps) {
    for (const [oilTypeId, litres] of out) {
      const cap = Number(caps.get(oilTypeId));
      if (cap > 0 && litres > cap) out.set(oilTypeId, cap);
    }
  }
  return out;
}

/** The premium line this job should carry, or null when no oil reaches a tier. */
export function tierPremiumFor(
  items: readonly AutoLineItem[],
  ctx: Pick<AutoLineContext, "oilTypes" | "tiers" | "tierCaps">,
): { amount: number; description: string } | null {
  const parts: string[] = [];
  let amount = 0;
  for (const [oilTypeId, litres] of oilLitresByType(items, ctx.oilTypes, ctx.tierCaps)) {
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

/** What the oil change on this job holds, and what oil beyond it costs. */
export interface ExtraOilRule {
  oilTypeId: string;
  /** Litres the engine holds — the oil change and its tier are priced on this. */
  capacity: number;
  /** The oil group's retail $/L for oil beyond the capacity. */
  retailRate: number;
  /** Description for the extra-oil line. */
  description: string;
}

/**
 * Extra oil is a retail sale (client 2026-10-20). Bulk litres of the
 * oil-change oil beyond the engine's capacity move to ONE "Extra oil" line at
 * the retail rate, which the tier premium doesn't count. Litres only ever move
 * out of the regular lines (trimmed from the last one back), so a staff edit to
 * the extra line sticks and nothing bounces back and forth. Gallon lines are
 * left alone: their quantity is jugs, not litres.
 */
export function splitExtraOil<T extends AutoLineItem>(
  items: readonly T[],
  rule: ExtraOilRule | null,
  makeLine: (partial: Partial<T>) => T,
): T[] {
  if (!rule || !(rule.capacity > 0)) return [...items];
  const isRegular = (it: T) =>
    it.oil_type_id === rule.oilTypeId &&
    !it.package_group &&
    !it.auto_fee &&
    !it.is_extra_oil &&
    !it.is_customer_supplied &&
    it.oil_container !== "gallon" &&
    Number(it.unit_price) >= 0;
  const regularLitres = items.filter(isRegular).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const moved = round2(regularLitres - rule.capacity);
  if (moved <= 0) return [...items];

  let over = moved;
  let taxable = true;
  const next: (T | null)[] = [...items];
  for (let i = next.length - 1; i >= 0 && over > 0; i--) {
    const it = next[i]!;
    if (!isRegular(it)) continue;
    taxable = it.is_taxable;
    const qty = Number(it.quantity) || 0;
    const take = Math.min(qty, over);
    over = round2(over - take);
    const left = round2(qty - take);
    next[i] = left > 0 ? { ...it, quantity: left } : null;
  }
  const kept = next.filter((it): it is T => it != null);

  const extra = kept.find((it) => it.is_extra_oil && it.oil_type_id === rule.oilTypeId);
  if (extra) {
    return kept.map((it) =>
      it === extra ? { ...it, quantity: round2((Number(it.quantity) || 0) + moved) } : it,
    );
  }
  return [
    ...kept,
    makeLine({
      part_id: null,
      description: rule.description,
      quantity: moved,
      unit_price: round2(rule.retailRate),
      is_taxable: taxable,
      oil_type_id: rule.oilTypeId,
      oil_container: "bulk",
      is_extra_oil: true,
    } as Partial<T>),
  ];
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
/**
 * An automatic charge. `quantity` x `unitPrice` is the amount when the line can
 * show a real quantity (5 filters at 1.50, 40 litres at 0.06); without them it
 * is one line of the whole amount. MHSW lines carry a quantity so the invoice
 * and the report can say how many were charged (client 2026-11-27: 3 package
 * filters + 2 extra = quantity 5, not 1).
 */
export interface AutoCharge {
  amount: number;
  description: string;
  quantity?: number;
  unitPrice?: number;
}

export const MHSW_PARTS_DESCRIPTION = "MHSW — parts";
export const MHSW_OIL_DESCRIPTION = "MHSW — bulk oil";

/** A return line (negative price) gives its MHSW back. */
const lineSign = (it: AutoLineItem) => (Number(it.unit_price) < 0 ? -1 : 1);

/** Lines that never carry MHSW: automatic lines, the customer's own part or
 *  oil, and merged duplicates billed at $0. */
const noMhsw = (it: AutoLineItem) =>
  Boolean(it.auto_fee) || Boolean(it.is_customer_supplied) || it.merged_unit_price != null;

/**
 * Sell MHSW of the parts on the job: each part line's mhsw_unit × quantity.
 * A package part whose price is fixed (locked or typed) carries mhsw_unit 0 —
 * that price was set with MHSW inside it.
 */
export function mhswPartsCharge(items: readonly AutoLineItem[]): AutoCharge | null {
  let amount = 0;
  let count = 0;
  for (const it of items) {
    if (!it.part_id || noMhsw(it)) continue;
    const unit = Number(it.mhsw_unit) || 0;
    const qty = Number(it.quantity) || 0;
    if (unit <= 0 || qty <= 0) continue;
    amount += lineSign(it) * unit * qty;
    count += lineSign(it) * qty;
  }
  amount = round2(amount);
  if (amount === 0) return null;
  // The line shows how many parts carry MHSW. unit_price holds 2 decimals, so
  // quantity x price must come back to the amount to the cent (three at 1.50,
  // or 3 + 2 with an even average, do; an average like 1.6667 doesn't). When
  // it doesn't, the line is one charge of the whole amount.
  if (count > 0) {
    const unitPrice = round2(amount / count);
    if (round2(count * unitPrice) === amount) {
      return { amount, description: MHSW_PARTS_DESCRIPTION, quantity: count, unitPrice };
    }
  }
  return { amount, description: MHSW_PARTS_DESCRIPTION };
}

/**
 * MHSW on bulk oil: litres × the per-litre rate. Every standalone bulk oil
 * line counts — the oil change's oil and the extra oil alike. Gallon jugs and
 * oil inside a package (whose quantity is a package count, not litres) don't.
 */
export function mhswOilCharge(
  items: readonly AutoLineItem[],
  perLitre: number,
): AutoCharge | null {
  const rate = Number(perLitre) || 0;
  if (rate <= 0) return null;
  let litres = 0;
  for (const it of items) {
    if (!it.oil_type_id || it.package_group || noMhsw(it)) continue;
    if (it.oil_container !== "bulk") continue;
    const qty = Number(it.quantity) || 0;
    if (qty <= 0) continue;
    litres += lineSign(it) * qty;
  }
  litres = round2(litres);
  const amount = round2(litres * rate);
  if (amount === 0) return null;
  // Litres x the per-litre rate, shown as the line's quantity and price (40 at
  // 0.06). A rate with more than 2 decimals can't be held in unit_price, so it
  // stays one line of the whole amount with the working in the description.
  if (litres > 0 && round2(rate) === rate && round2(litres * rate) === amount) {
    return { amount, description: MHSW_OIL_DESCRIPTION, quantity: litres, unitPrice: rate };
  }
  return {
    amount,
    description: `${MHSW_OIL_DESCRIPTION} (${fmtLitres(litres)} × $${Number(rate.toFixed(4))}/L)`,
  };
}

/** What each automatic charge WOULD be right now, ignoring waivers. */
export function autoCharges(
  items: readonly AutoLineItem[],
  ctx: AutoLineContext,
): Record<AutoFee, AutoCharge | null> {
  const fee = Number(ctx.greaseOnlyFee) || 0;
  return {
    oil_tier_premium: tierPremiumFor(items, ctx),
    grease_only_fee:
      fee > 0 && !ctx.freeGreaseApplied && isGreaseOnlyJob(items, ctx.bucketOf)
        ? { amount: round2(fee), description: GREASE_ONLY_FEE_DESCRIPTION }
        : null,
    mhsw_parts: mhswPartsCharge(items),
    mhsw_oil: mhswOilCharge(items, ctx.mhswOilPerLitre),
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
  for (const kind of AUTO_FEES) {
    if (ctx.waived[kind]) continue;
    const want = charges[kind];
    const existing = next.find((it) => it.auto_fee === kind);
    if (!want) {
      if (existing) next = next.filter((it) => it !== existing);
      continue;
    }
    const wantQty = want.quantity ?? 1;
    const wantPrice = want.unitPrice ?? want.amount;
    if (existing) {
      if (
        Number(existing.unit_price) !== wantPrice ||
        existing.description !== want.description ||
        Number(existing.quantity) !== wantQty
      ) {
        next = next.map((it) =>
          it === existing
            ? { ...it, unit_price: wantPrice, description: want.description, quantity: wantQty }
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
        quantity: wantQty,
        unit_price: wantPrice,
        is_taxable: true,
        auto_fee: kind,
      } as Partial<T>),
    ];
  }
  return next;
}
