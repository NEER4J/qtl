import type { StatutoryRate } from "@/lib/db/types";

export interface ComputedDeductions {
  /** Employee EI premium (insurable × ei rate, capped at the weekly max). */
  ei: number;
  /** Employee CPP tier 1 premium. */
  cpp: number;
  /** Employee CPP tier 2 premium (earnings between YMPE and YAMPE). */
  cpp2: number;
  /** Employer EI = employee EI × ei_employer_multiplier (typically 1.4×). */
  ei_employer: number;
  /** Employer CPP tier 1 = matches employee tier 1 (1:1 in CA). */
  cpp_employer: number;
  /** Employer CPP tier 2 = matches employee tier 2 (1:1 in CA). */
  cpp_employer2: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

// ============================================================================
// Entry pay — one definition of gross / insurable / vacation / net, shared by
// the save (buildEntryPayload), the entry dialog's preview, and every screen,
// export and stub that totals an entry, so they can't drift apart again.
// ============================================================================

/** The earnings columns of a payroll entry. phone_allowance is optional: rows
 *  read before migration 0158 don't have it, and count it as 0. */
export interface PayEarnings {
  gross_wages: number;
  overtime_wages: number;
  bonus: number;
  holiday_pay: number;
  misc_extra: number;
  phone_allowance?: number | null;
}

/**
 * First day of the Payroll page's rolling 12 months: the same date a year
 * back (Feb 29 → Feb 28). Pay weeks starting on or after it count.
 */
export function rollingYearStart(todayYmd: string): string {
  const y = Number(todayYmd.slice(0, 4)) - 1;
  const md = todayYmd.slice(5, 10);
  return md === "02-29" ? `${y}-02-28` : `${y}-${md}`;
}

/** Gross earnings of a saved entry: regular + OT + bonus + holiday + other
 *  taxable extras + phone allowance (client 2026-10-20). */
export function payrollGross(e: PayEarnings): number {
  return round2(
    num(e.gross_wages) +
      num(e.overtime_wages) +
      num(e.bonus) +
      num(e.holiday_pay) +
      num(e.misc_extra) +
      num(e.phone_allowance),
  );
}

export interface PayDeductions {
  ei_employee: number;
  cpp_employee: number;
  cpp_employee2: number;
  income_tax: number;
  benefit_employee_deduction: number;
}

/** Employee-side deductions of a saved entry. */
export function payrollDeductions(e: PayDeductions): number {
  return round2(
    num(e.ei_employee) +
      num(e.cpp_employee) +
      num(e.cpp_employee2) +
      num(e.income_tax) +
      num(e.benefit_employee_deduction),
  );
}

/**
 * The vacation rate to use: the first one that is set, in the order given —
 * callers pass entry → employee override → shop rate (client 2026-10-20).
 */
export function resolveVacationRate(...rates: (number | string | null | undefined)[]): number {
  for (const r of rates) {
    if (r === null || r === undefined || r === "") continue;
    const n = Number(r);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

export interface EntryPayInput {
  hours: number;
  rate: number;
  overtime_hours: number;
  overtime_rate: number;
  holiday_hours: number;
  holiday_rate: number;
  bonus: number;
  misc_extra: number;
  phone_allowance?: number | null;
  apply_vacation: boolean;
}

export interface EntryEarnings {
  /** hours × rate — stored as payroll_entries.gross_wages. */
  regularWages: number;
  overtimeWages: number;
  /** Rate the holiday hours were paid at (falls back to the regular rate). */
  holidayRate: number;
  holidayPay: number;
  phoneAllowance: number;
  /** Everything paid: regular + OT + bonus + holiday + misc + phone. */
  gross: number;
  /** EI / CPP / WSIB base: everything but misc_extra. */
  insurable: number;
  /** regular + OT + bonus + holiday — phone allowance and misc are left out. */
  vacationBase: number;
  vacationPay: number;
}

/**
 * Earnings for one entry from what was typed.
 *
 * Phone allowance is taxable AND insurable (the owner's call, client
 * 2026-10-20): it is in gross, insurable earnings and net, but not the
 * vacation base. misc_extra stays taxable but not insurable.
 */
export function computeEntryEarnings(input: EntryPayInput, vacationRate: number): EntryEarnings {
  const regularWages = round2(num(input.hours) * num(input.rate));
  const overtimeWages = round2(num(input.overtime_hours) * num(input.overtime_rate));
  // Holiday pay is hours × rate (0136). Hours with no holiday rate fall back to
  // the regular rate — stat hours at $0 is never what anyone meant.
  const holidayRate = num(input.holiday_rate) > 0 ? num(input.holiday_rate) : num(input.rate);
  const holidayPay = round2(num(input.holiday_hours) * holidayRate);
  const bonus = num(input.bonus);
  const phoneAllowance = num(input.phone_allowance);

  const vacationBase = round2(regularWages + overtimeWages + bonus + holidayPay);
  const vacationPay = input.apply_vacation ? round2(vacationBase * vacationRate) : 0;
  const insurable = round2(vacationBase + phoneAllowance);
  const gross = round2(insurable + num(input.misc_extra));

  return {
    regularWages,
    overtimeWages,
    holidayRate,
    holidayPay,
    phoneAllowance,
    gross,
    insurable,
    vacationBase,
    vacationPay,
  };
}

/** Net pay: gross less the employee-side deductions actually applied. */
export function computeNetPay(
  gross: number,
  d: { ei: number; cpp: number; cpp2: number; incomeTax: number; benefit: number },
): number {
  return round2(gross - num(d.ei) - num(d.cpp) - num(d.cpp2) - num(d.incomeTax) - num(d.benefit));
}

/**
 * The rate an entry saved before 0158 was accrued at, worked back from its
 * stored vacation_pay — so re-saving it doesn't silently switch it to today's
 * rate. Null when it can't be told (vacation off, or nothing earned).
 */
export function inferVacationRate(e: {
  apply_vacation?: boolean | null;
  vacation_pay: number;
  gross_wages: number;
  overtime_wages: number;
  bonus: number;
  holiday_pay: number;
}): number | null {
  if (e.apply_vacation === false) return null;
  const base = num(e.gross_wages) + num(e.overtime_wages) + num(e.bonus) + num(e.holiday_pay);
  if (base <= 0 || num(e.vacation_pay) <= 0) return null;
  return Math.round((num(e.vacation_pay) / base) * 10000) / 10000;
}

/**
 * Compute all statutory deductions (employee + employer side) for a single
 * weekly pay entry. Rate tables and YMPE/YAMPE caps come from statutory_rates.
 *
 * EI: capped at annual_max_insurable / 52 per week. Employer side is
 * `ei * ei_employer_multiplier`.
 *
 * CPP tier 1: applies to (insurable − basic_exemption_weekly), capped at
 * (annual_max_pensionable − basic_exemption) / 52. Employer matches 1:1.
 *
 * CPP tier 2: applies to insurable above YMPE up to YAMPE.
 * Weekly cap = (annual_max_pensionable2 − annual_max_pensionable) / 52.
 */
export function computeStatutoryDeductions(
  insurable: number,
  rates: StatutoryRate[],
  year: number,
): ComputedDeductions {
  const find = (type: string) => rates.find((r) => r.year === year && r.type === type);

  const eiRate = find("ei_employee");
  const eiMult = find("ei_employer_multiplier")?.rate ?? 1.4;
  const cppRate = find("cpp_employee");
  const cpp2Rate = find("cpp2_employee");

  const eiCap = eiRate?.annual_max_insurable ?? 0;
  const ympe = cppRate?.annual_max_pensionable ?? 0;
  const yampe = cpp2Rate?.annual_max_pensionable2 ?? 0;
  const basicExemption = cppRate?.basic_exemption ?? 3500;

  const weeklyEiCap = eiCap / 52;
  const weeklyCpp1Cap = Math.max((ympe - basicExemption) / 52, 0);
  const weeklyCpp2Cap = Math.max((yampe - ympe) / 52, 0);

  // ------- Employee -------
  const ei = round2(Math.min(insurable, weeklyEiCap) * (eiRate?.rate ?? 0));

  const cpp1Base = Math.min(
    Math.max(insurable - basicExemption / 52, 0),
    weeklyCpp1Cap,
  );
  const cpp = round2(cpp1Base * (cppRate?.rate ?? 0));

  const cpp2Base = Math.min(Math.max(insurable - ympe / 52, 0), weeklyCpp2Cap);
  const cpp2 = round2(cpp2Base * (cpp2Rate?.rate ?? 0));

  // ------- Employer -------
  const ei_employer = round2(ei * eiMult);
  const cpp_employer = cpp; // 1:1 employer match
  const cpp_employer2 = cpp2;

  return { ei, cpp, cpp2, ei_employer, cpp_employer, cpp_employer2 };
}
