/**
 * Human-readable list of the statutory items switched OFF for a payroll row
 * (migration 0135). Used wherever an entry is shown, so a $0 EI column reads as
 * "exempt" rather than "someone forgot to fill it in".
 *
 * CPP2 is folded into CPP: an entry with CPP off always has CPP2 off with it
 * (buildEntryPayload enforces that), and printing "CPP, CPP2" says nothing the
 * first word didn't.
 */
export interface DeductionFlagRow {
  apply_ei: boolean;
  apply_cpp: boolean;
  apply_cpp2: boolean;
  apply_income_tax: boolean;
  apply_vacation: boolean;
  apply_wsib: boolean;
}

export function deductionExemptions(row: DeductionFlagRow): string[] {
  // `=== false`, not `!`: a row read back before migration 0135 is applied has
  // no apply_* columns at all, and treating `undefined` as "off" would label
  // every employee exempt from everything.
  const off: string[] = [];
  if (row.apply_ei === false) off.push("EI");
  if (row.apply_cpp === false) off.push("CPP");
  else if (row.apply_cpp2 === false) off.push("CPP2");
  if (row.apply_income_tax === false) off.push("tax");
  if (row.apply_vacation === false) off.push("vacation");
  if (row.apply_wsib === false) off.push("WSIB");
  return off;
}
