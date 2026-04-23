// Thin wrapper around sheetjs that normalises header names and returns rows
// as plain objects keyed by the normalised header.
//
// Header normalisation:
//   "Invoice No."  → "invoice_no"
//   "Billing Name" → "billing_name"
//   "HST ($)"      → "hst"
//   "Sub-Total"    → "sub_total"

import { readFile, utils, type WorkBook, type WorkSheet } from "xlsx";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type Row = Record<string, unknown>;

export interface Sheet {
  name: string;
  rows: Row[];
  rawHeaders: string[];
  normalisedHeaders: string[];
}

export function openWorkbook(pathRel: string): WorkBook {
  const full = resolve(process.cwd(), pathRel);
  if (!existsSync(full)) {
    throw new Error(
      `Workbook not found: ${pathRel}\nDrop the Excel file into scripts/migrate/data/ and rerun.`,
    );
  }
  return readFile(full, { cellDates: true, raw: false });
}

export function readSheet(wb: WorkBook, sheetName: string): Sheet {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    const available = wb.SheetNames.join(", ");
    throw new Error(`Sheet "${sheetName}" not found. Available: ${available}`);
  }
  return toSheet(sheetName, ws);
}

export function readAllSheets(wb: WorkBook): Sheet[] {
  return wb.SheetNames.map((n) => toSheet(n, wb.Sheets[n]));
}

function toSheet(name: string, ws: WorkSheet): Sheet {
  // header:1 gives us rows as arrays so we can grab the raw header row.
  const aoa = utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: false,
  });

  if (aoa.length === 0) {
    return { name, rows: [], rawHeaders: [], normalisedHeaders: [] };
  }

  const rawHeaders = aoa[0].map((h) => (h == null ? "" : String(h)));
  const normalisedHeaders = rawHeaders.map(normaliseHeader);

  const rows: Row[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((v) => v === null || v === "" || v === undefined)) continue;
    const obj: Row = {};
    for (let c = 0; c < normalisedHeaders.length; c++) {
      const key = normalisedHeaders[c];
      if (!key) continue;
      obj[key] = r[c];
    }
    rows.push(obj);
  }

  return { name, rows, rawHeaders, normalisedHeaders };
}

export function normaliseHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")     // strip anything in parens: "HST (CAD)" → "HST "
    .replace(/[^a-z0-9]+/g, "_")  // non-alnum → underscore
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

/**
 * Require that every key in `required` is present in `sheet.normalisedHeaders`.
 * Throws a human-readable error listing what's missing and what was seen.
 */
export function requireHeaders(sheet: Sheet, required: string[]): void {
  const have = new Set(sheet.normalisedHeaders);
  const missing = required.filter((k) => !have.has(k));
  if (missing.length === 0) return;
  throw new Error(
    `Sheet "${sheet.name}" is missing columns: ${missing.join(", ")}\n` +
      `  Raw headers seen: ${sheet.rawHeaders.join(" | ")}\n` +
      `  Normalised:       ${sheet.normalisedHeaders.join(" | ")}\n` +
      `  Adjust the mapping in scripts/migrate/utils/parse-xlsx.ts or the ` +
      `step file if the header wording differs from the spec.`,
  );
}
