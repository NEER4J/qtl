// Collapse package line items into a single display line.
//
// A package added to a sales job is stored as several `sales_job_items` rows
// (one per part / oil / service, plus a labour row), all sharing one
// `package_group` uuid. For display — the job detail view, the PDF invoice,
// and the line-items editor — we never show that breakdown: each package
// instance becomes ONE line with its name and combined total. The underlying
// rows stay in the database so HST splits, product analytics, and cost
// reporting remain correct.

export interface GroupableLine {
  package_group?: string | null;
  package_label?: string | null;
}

/**
 * Stable grouping key for a line. Prefers the per-instance `package_group`
 * uuid; falls back to the `package_label` snapshot for pre-0068 rows (which
 * never carried a group id). Returns null for standalone lines.
 */
export function packageGroupKey(it: GroupableLine): string | null {
  if (it.package_group) return it.package_group;
  if (it.package_label) return `label:${it.package_label}`;
  return null;
}

export type DisplayRow<T> =
  | { type: "single"; item: T }
  | {
      type: "package";
      key: string;
      /** Package name to show on the collapsed line. */
      label: string;
      /** Combined total of every line in the package instance. */
      total: number;
      /** Combined total of the taxable lines only. */
      taxableTotal: number;
      /** The underlying rows (kept for callers that still need them). */
      items: T[];
    };

/**
 * Walk `items` in order, collapsing runs that share a package group into a
 * single `package` row emitted at the position of the group's first item.
 * Standalone lines pass through as `single` rows.
 *
 * @param amount   line total for an item (stored line_total, or computed).
 * @param taxable  whether the item contributes to the HST base.
 */
export function buildDisplayRows<T extends GroupableLine>(
  items: T[],
  amount: (it: T) => number,
  taxable: (it: T) => boolean,
  label: (it: T) => string,
): DisplayRow<T>[] {
  const out: DisplayRow<T>[] = [];
  const groupIndex = new Map<string, number>(); // key → index in `out`

  for (const it of items) {
    const key = packageGroupKey(it);
    if (key == null) {
      out.push({ type: "single", item: it });
      continue;
    }
    const amt = round2(amount(it));
    const taxAmt = taxable(it) ? amt : 0;
    const existing = groupIndex.get(key);
    if (existing == null) {
      out.push({
        type: "package",
        key,
        label: label(it),
        total: amt,
        taxableTotal: taxAmt,
        items: [it],
      });
      groupIndex.set(key, out.length - 1);
    } else {
      const row = out[existing] as Extract<DisplayRow<T>, { type: "package" }>;
      row.total = round2(row.total + amt);
      row.taxableTotal = round2(row.taxableTotal + taxAmt);
      row.items.push(it);
    }
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Group-key prefix of an oil folded together with its tier premium. */
export const OIL_TIER_GROUP = "oil-tier:";

export interface FoldableLine extends GroupableLine {
  description: string;
  quantity: number | string;
  unit_price: number | string;
  oil_type_id?: string | null;
  oil_container?: "bulk" | "gallon" | null;
  auto_fee?: string | null;
  is_extra_oil?: boolean;
  is_customer_supplied?: boolean;
}

/**
 * Show an oil and its volume tier premium as ONE line (client 2026-10-20 —
 * "show the oil and tier price as one; the other can be marked Included").
 * When the job's tier premium belongs to a single oil line, the two share a
 * display-only group so buildDisplayRows collapses them like a package: one
 * line with the combined amount, both listed under it as "Included". With
 * several oils the premium covers all of them, so it stays on its own line.
 * Display only — the stored lines, HST and reports don't change.
 */
export function foldOilTier<T extends FoldableLine>(items: T[]): T[] {
  const tiers = items.filter((it) => it.auto_fee === "oil_tier_premium");
  if (tiers.length !== 1) return items;
  const oils = items.filter(
    (it) =>
      it.oil_type_id &&
      packageGroupKey(it) == null &&
      !it.auto_fee &&
      !it.is_extra_oil &&
      !it.is_customer_supplied &&
      Number(it.unit_price) >= 0,
  );
  if (oils.length !== 1) return items;
  const oil = oils[0]!;
  const tier = tiers[0]!;
  const unit = oil.oil_container === "gallon" ? "gal" : "L";
  const label = `${oil.description} × ${Number(oil.quantity)} ${unit} (incl. volume tier)`;
  const key = `${OIL_TIER_GROUP}${oil.oil_type_id}`;
  // The premium sits right under its oil, wherever it was on the job.
  const rest = items.filter((it) => it !== tier);
  return rest.flatMap((it) =>
    it === oil
      ? [
          { ...it, package_group: key, package_label: label },
          { ...tier, package_group: key, package_label: label },
        ]
      : [it],
  );
}
