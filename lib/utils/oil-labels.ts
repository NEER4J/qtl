/**
 * How an oil grade is labelled anywhere in the app.
 *
 * Until 2026-09-01 this file carried a hardcoded EXCEL_OIL_LABEL map keyed by
 * oil_types.code, which rewrote the grade's name into the short label the May
 * 2026 spreadsheet used ("Delo 400 XLE SB 15W40" → "15W40"). That map won over
 * whatever Settings → Oil types said, so renaming a grade there changed the
 * settings table and nothing else: sales lines, the pickers, the oil grid and
 * the print list all kept showing the old spreadsheet label. After the client
 * re-coded and renamed every grade (2026-08-31) only 5 codes still matched the
 * map — those 5 were the ones stuck on their old names, the other 17 already
 * fell through to oil_types.name — so the map had stopped buying consistency
 * and was only producing that bug.
 *
 * oil_types.name is now the single source of truth: what Settings shows is what
 * everything shows. Note that a sales line stores its description as a snapshot
 * at the moment it is added, so a rename moves the pickers and every page that
 * reads oil_types live, but it does NOT rewrite jobs already saved.
 */

/** The grade's name on its own — pickers, sales lines, grid headers, print. */
export function oilLabel(oil: { name: string }): string {
  return oil.name;
}

/** Code-prefixed variant, for purchase-side screens where staff match against
 *  a vendor invoice line and need the part number in front of them. */
export function oilLabelWithCode(oil: { code: string; name: string }): string {
  return `${oil.code} — ${oil.name}`;
}
