// Stable row hashing for dedup tracking. The hash identifies a row's
// *content*; if the Excel cell values change, the row is treated as new.

import { createHash } from "node:crypto";

export function hashRow(values: unknown[]): string {
  const h = createHash("sha256");
  for (const v of values) {
    h.update("\x1f"); // unit separator
    h.update(stringifyForHash(v));
  }
  return h.digest("hex").slice(0, 32);
}

function stringifyForHash(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim().toLowerCase();
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "1" : "0";
  return JSON.stringify(v);
}
