import type { StatutoryRate } from "@/lib/db/types";

export function computeStatutoryDeductions(
  insurable: number,
  rates: StatutoryRate[],
  year: number,
): { ei: number; cpp: number } {
  const find = (type: string) => rates.find((r) => r.year === year && r.type === type);

  const eiRate = find("ei_employee");
  const cppRate = find("cpp_employee");

  const eiCap = eiRate?.annual_max_insurable ?? 0;
  const cppCap = cppRate?.annual_max_pensionable ?? 0;
  const basicExemption = cppRate?.basic_exemption ?? 3500;

  const weeklyEiCap = eiCap / 52;
  const weeklyCppCap = (cppCap - basicExemption) / 52;

  const ei = Math.round(Math.min(insurable, weeklyEiCap) * (eiRate?.rate ?? 0) * 100) / 100;
  const cpp =
    Math.round(
      Math.min(Math.max(insurable - basicExemption / 52, 0), weeklyCppCap) *
        (cppRate?.rate ?? 0) *
        100,
    ) / 100;

  return { ei, cpp };
}
