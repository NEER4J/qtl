import { getPayrollWeek } from "@/lib/actions/payroll";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { hiddenColumnsForPage } from "@/lib/permissions/check";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { deductionExemptions } from "@/lib/utils/payroll-flags";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

/**
 * One pay week as a spreadsheet: the entry register, the daily cash days, and
 * the payments. RLS on payroll_weeks decides whether the caller sees anything
 * at all; hidden columns are honoured on top of that so the export can't be
 * used to read a column the owner hid on screen.
 */
export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "portal_customer") {
    return new Response("Unauthorized", { status: 401 });
  }

  const weekId = new URL(req.url).searchParams.get("week_id");
  if (!weekId) return new Response("week_id is required", { status: 400 });

  const week = await getPayrollWeek(weekId);
  if (!week) return new Response("Not found", { status: 404 });

  const hidden = hiddenColumnsForPage(profile, "payroll");
  const show = (key: string) => !hidden.has(key);

  const sections: string[] = [];
  sections.push(`# Payroll — ${week.location_name}`);
  sections.push(`# Pay period,${week.week_start},to,${week.week_end}`);
  sections.push(`# Status,${week.status}`);
  sections.push(`# Exported,${todayISO()}\n`);

  const entryRows = week.entries.map((e) => ({
    employee: e.employee_name,
    employee_code: e.employee_code ?? "",
    type: e.employee_payroll_type,
    ...(show("hours") ? { hours: e.hours, rate: e.rate } : {}),
    ...(show("overtime")
      ? { overtime_hours: e.overtime_hours, overtime_rate: e.overtime_rate }
      : {}),
    ...(show("gross")
      ? {
          gross: (
            e.gross_wages + e.overtime_wages + e.bonus + e.holiday_pay + e.misc_extra
          ).toFixed(2),
        }
      : {}),
    ...(show("holiday_vacation")
      ? {
          holiday_hours: e.holiday_hours,
          holiday_rate: e.holiday_rate || e.rate,
          holiday_pay: e.holiday_pay,
        }
      : {}),
    ...(show("ei_cpp")
      ? { ei: e.ei_employee, cpp: e.cpp_employee, cpp2: e.cpp_employee2 }
      : {}),
    ...(show("income_tax") ? { income_tax: e.income_tax } : {}),
    benefit_deduction: e.benefit_employee_deduction,
    ...(show("holiday_vacation") ? { vacation_accrued: e.vacation_pay } : {}),
    ...(show("benefits")
      ? {
          employer_ei: e.ei_employer,
          employer_cpp: e.cpp_employer + e.cpp_employer2,
          wsib: e.wsib_employer,
          employer_benefit: e.benefit_employer_contribution,
        }
      : {}),
    exemptions: deductionExemptions(e).join(" / "),
    cheque_amount: e.cheque_amount,
    cash_total: e.cash_total,
    ...(show("net_pay") ? { net_pay: e.net_pay } : {}),
    notes: e.notes ?? "",
  }));

  sections.push(`## Entries`);
  sections.push(toCsv(entryRows));
  sections.push("");

  const cashRows = week.entries.flatMap((e) =>
    e.cash_days.map((d) => ({
      employee: e.employee_name,
      day: d.day,
      amount: d.amount,
      notes: d.notes ?? "",
    })),
  );
  if (cashRows.length > 0) {
    sections.push(`## Daily cash`);
    sections.push(toCsv(cashRows, ["employee", "day", "amount", "notes"]));
    sections.push("");
  }

  const nameOf = (employeeId: string) =>
    week.entries.find((e) => e.employee_id === employeeId)?.employee_name ?? "";
  sections.push(`## Payments`);
  sections.push(
    toCsv(
      week.payments.map((p) => ({
        paid_on: p.paid_on,
        employee: nameOf(p.employee_id),
        mode: p.mode,
        reference: p.transaction_id ?? "",
        amount: p.amount,
        notes: p.notes ?? "",
      })),
      ["paid_on", "employee", "mode", "reference", "amount", "notes"],
    ),
  );

  return csvResponse(`payroll-${week.location_code || "week"}-${week.week_start}.csv`, sections.join("\n"));
}
