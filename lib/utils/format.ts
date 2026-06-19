/**
 * Money formatter — CAD, no-break spaces, .99-friendly.
 */
const money = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return money.format(n);
}

/**
 * Round a price UP to the next value ending in .99 (12.34 → 12.99, 13.00 →
 * 13.99, 12.99 → 12.99). Values ≤ 0 (e.g. $0 free lines, negative discount /
 * credit lines) are returned unchanged. Used to standardise job line prices.
 */
export function roundUpTo99(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  const cents = Math.round(value * 100);
  const dollars = Math.max(0, Math.ceil((cents - 99) / 100));
  return dollars + 0.99;
}

// Unit costs can carry sub-cent precision (e.g. per-litre buying prices like
// 1.3712). Show at least 2 decimals, up to 6, trimming trailing zeros so a
// plain $1.37 still reads cleanly but 1.3712 isn't silently rounded.
const unitCost = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

export function formatUnitCost(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return unitCost.format(n);
}

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return dateFmt.format(d);
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
