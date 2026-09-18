// Which cost column a part category counts toward on the oil-change pricing
// pages (Oil detail, Oil-change detailed pricing) and in grease-only detection.
//
// Each part category carries its own bucket (part_categories.cost_bucket,
// migration 0147), set in Settings → Pricing → Part categories, so categories —
// not string matching — decide what is a filter, oil, fuel or grease cost
// (client 2026-09-15). `costBucketFor` falls back to the same name rule the
// 0147 backfill used, so the pages behave identically before that migration.
//
// Plain module (not "use server") so client components can import it too.

export const COST_BUCKETS = ["filter", "oil", "fuel", "grease", "other"] as const;
export type CostBucket = (typeof COST_BUCKETS)[number];

export const COST_BUCKET_LABEL: Record<CostBucket, string> = {
  filter: "Filter",
  oil: "Oil",
  fuel: "Fuel",
  grease: "Grease",
  other: "Other",
};

export function isCostBucket(v: unknown): v is CostBucket {
  return typeof v === "string" && (COST_BUCKETS as readonly string[]).includes(v);
}

/**
 * The name rule behind the 0147 backfill. Fuel and grease match the name
 * EXACTLY (what the pricing pages matched before categories carried a bucket),
 * so "Fuel Filter" / "Fuel Separator" are filters and "Fuel Additive" isn't
 * fuel. Anything named like a filter, separator or spinner is a filter; a
 * name with the word "oil" in it (and no "filter") is oil.
 */
export function costBucketFromName(name: string | null | undefined): CostBucket {
  const n = (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (n === "fuel") return "fuel";
  if (n === "grease") return "grease";
  if (/filter|separator|spinner/.test(n)) return "filter";
  if (/\boil\b/.test(n)) return "oil";
  return "other";
}

/** A category's bucket: its own setting when present, else the name rule. */
export function costBucketFor(
  category: { name?: string | null; cost_bucket?: string | null } | null | undefined,
): CostBucket {
  if (category && isCostBucket(category.cost_bucket)) return category.cost_bucket;
  return costBucketFromName(category?.name);
}
