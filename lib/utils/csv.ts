// CSV export utility — RFC 4180 compliant quoting.

function escape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  rows: readonly Record<string, unknown>[],
  columns?: readonly string[],
): string {
  if (rows.length === 0 && !columns) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(escape).join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * A report's CSV: fractional numbers are rounded to 2 decimals, so sums like
 * 0.1 + 0.2 don't export as 0.30000000000000004 (client 2026-11-03). Use this
 * for reports; data exports with sub-cent unit costs keep toCsv.
 */
export function toReportCsv(
  rows: readonly Record<string, unknown>[],
  columns?: readonly string[],
): string {
  const rounded = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = typeof v === "number" && Number.isFinite(v) && !Number.isInteger(v)
        ? Math.round((v + Number.EPSILON) * 100) / 100
        : v;
    }
    return out;
  });
  return toCsv(rounded, columns);
}
