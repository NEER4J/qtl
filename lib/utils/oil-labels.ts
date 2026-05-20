/**
 * Excel-style short labels for oil_types, keyed by oil_types.code.
 *
 * The May 2026 Excel uses short tab/column names ("15W40", "T6", "Delo SYN
 * 5W30") that the shop staff recognise at a glance. Our oil_types.name values
 * are the longer SKU names ("Delo 400 XLE SB 15W40", "Shell T6 5W30"). For
 * pricing pages we want the Excel-style short label so the platform reads the
 * same as the spreadsheet.
 *
 * Canonical oils (the Excel-mapped one per grade) use the pure Excel label.
 * Sibling brands of the same grade get a brand suffix to keep them
 * distinguishable in pickers — e.g. "15W40 Mobil" vs "15W40 Shell T4".
 */
export const EXCEL_OIL_LABEL: Record<string, string> = {
  // ---- 15W40 -----------------------------------------------------------
  "257004":    "15W40",            // Delo 400 XLE SB — canonical
  "19":        "15W40 Mobil",
  "500010048": "15W40 Shell T4",

  // ---- 10W30 -----------------------------------------------------------
  "10":        "10W30",            // Delo 400LE — canonical
  "20":        "10W30 Mobil",
  "23":        "10W30 Total",

  // ---- Other 10W30s (already brand-prefixed in Excel) ------------------
  "21":        "Petro 10W30",      // Petro Duron UHP
  "500010047": "T5",               // Shell T5 10W30 — Excel calls it T5

  // ---- 5W30 / 5W40 synthetic ------------------------------------------
  "14":        "T6 5W30",          // Shell T6 5W30
  "9":         "T6 5W40",          // Shell T6 5W40
  "11":        "Delo SYN 5W30",    // Delo 400XSP 5W30
  "12":        "Delo SYN 5W40",    // Delo 400XSP 5W40
  "22":        "Petro SYN 5W30",   // Petro 5W30

  // ---- Trans / gear oils ----------------------------------------------
  "13":        "Delo XDM 75W90",
  "15":        "Delo XE 75W90",
  "16":        "Delo EP-5 80W90",
  "17":        "Delo XV (IShift)",
  "18":        "Delo AMT XDT (DT12)",

  // ---- Other ----------------------------------------------------------
  "FUEL":      "Fuel",
};

/**
 * Return the Excel-style short label for an oil. Falls back to `fallback`
 * (typically `oil_types.name`) for codes that aren't in the May 2026 map —
 * useful for new oils added after this file was written.
 */
export function excelOilLabel(code: string, fallback: string): string {
  return EXCEL_OIL_LABEL[code] ?? fallback;
}
