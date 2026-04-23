// String / enum normalisers used across all importer steps.
// Every mapping here is a candidate for owner review; keep the behaviour in
// sync with the canonical values in supabase/migrations/0001_init.sql.

import type { PaymentMode, PaymentStatus, ServiceCode } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// Locations
// ----------------------------------------------------------------------------

const LOCATION_CODE_MAP: Record<string, string> = {
  AYR: "AYR",
  "AY": "AYR",
  "AYR.": "AYR",
  FE: "FE",
  "F.E.": "FE",
  "FORT ERIE": "FE",
  NP: "NP",
  NAPANEE: "NP",
};

export function normaliseLocationCode(raw: unknown): string | null {
  const s = toStr(raw).toUpperCase();
  if (!s) return null;
  return LOCATION_CODE_MAP[s] ?? null;
}

// ----------------------------------------------------------------------------
// Service types
// ----------------------------------------------------------------------------

const SERVICE_CODE_MAP: Record<string, ServiceCode> = {
  OC: "OC",
  "OIL CHANGE": "OC",
  PG: "PG",
  "PIT GREASE": "PG",
  FG: "FG",
  "FULL GREASE": "FG",
  MISC: "MISC",
  MISCELLANEOUS: "MISC",
};

export function normaliseServiceCode(raw: unknown): ServiceCode | null {
  const s = toStr(raw).toUpperCase();
  if (!s) return null;
  return SERVICE_CODE_MAP[s] ?? null;
}

// ----------------------------------------------------------------------------
// Payment modes
// ----------------------------------------------------------------------------

const PAYMENT_MODE_MAP: Record<string, PaymentMode> = {
  VISA: "visa",
  MC: "mastercard",
  MASTERCARD: "mastercard",
  "MASTER CARD": "mastercard",
  DEBIT: "debit",
  INTERAC: "debit",
  CASH: "cash",
  CHEQUE: "cheque",
  CHECK: "cheque",
  ETRANSFER: "etransfer",
  "E-TRANSFER": "etransfer",
  "E TRANSFER": "etransfer",
  OC: "oc",
  "ON ACCOUNT": "oc",
  CC: "credit_card",
  "CREDIT CARD": "credit_card",
};

export function normalisePaymentMode(raw: unknown): PaymentMode | null {
  const s = toStr(raw).toUpperCase();
  if (!s) return null;
  return PAYMENT_MODE_MAP[s] ?? null;
}

// ----------------------------------------------------------------------------
// Payment status
// ----------------------------------------------------------------------------

export function derivePaymentStatus(
  total: number,
  paid: number,
): PaymentStatus {
  if (paid <= 0.005) return "outstanding";
  if (paid + 0.005 < total) return "partial";
  return "paid";
}

// ----------------------------------------------------------------------------
// Numbers + text
// ----------------------------------------------------------------------------

export function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function toOptStr(v: unknown): string | null {
  const s = toStr(v);
  return s.length > 0 ? s : null;
}

export function toMoney(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return round2(v);
  const s = String(v).replace(/[, $]/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Not a money value: ${v}`);
  return round2(n);
}

export function toOptInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (Number.isNaN(n)) return null;
  return Math.trunc(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ----------------------------------------------------------------------------
// Dates. xlsx emits either ISO strings or JS Dates depending on cell type.
// ----------------------------------------------------------------------------

export function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial number — days since 1900-01-00 (with the 1900 leap-year bug).
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + v * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------------------------------
// License plates: comma/space separated → array, uppercased, deduped.
// ----------------------------------------------------------------------------

export function toPlates(v: unknown): string[] {
  const s = toStr(v).toUpperCase();
  if (!s) return [];
  const parts = s
    .split(/[,;/]+|\s{2,}/)
    .map((x) => x.replace(/[^A-Z0-9-]/g, "").trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

// ----------------------------------------------------------------------------
// Billing name — used for customer dedup
// ----------------------------------------------------------------------------

export function normaliseBillingName(raw: unknown): string {
  return toStr(raw).replace(/\s+/g, " ").trim();
}

export function billingNameKey(raw: unknown): string {
  return normaliseBillingName(raw).toLowerCase();
}
