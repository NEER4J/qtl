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
