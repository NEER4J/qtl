/**
 * Pay stub data (client 2026-10-20): turns one pay week, its employees, and
 * their year-to-date entries into the plain rows the PDF prints
 * (components/pdf/PayStubPdf.tsx). Kept free of server and PDF imports so the
 * numbers can be checked on their own.
 *
 * Hidden columns are honoured exactly as on the printable stub sheet: printing
 * must not become a way around a column the owner hid on screen.
 */
import type { PayrollEntry, PayrollPayment, PayrollWeekStatus } from "@/lib/db/types";
import { deductionExemptions } from "@/lib/utils/payroll-flags";
import { inferVacationRate, payrollDeductions, payrollGross } from "@/lib/utils/payroll-math";
import { paymentModeLabel } from "@/lib/utils/payment-modes";

/** The week as getPayrollWeek returns it (only what a stub needs). */
export interface StubWeek {
  week_start: string;
  week_end: string;
  period_weeks: number;
  status: PayrollWeekStatus;
  pay_date: string | null;
  location_name: string;
  location_address: string | null;
  location_phone: string | null;
  location_invoice_name: string | null;
  location_hst_number: string | null;
  entries: StubEntry[];
  payments: PayrollPayment[];
}

export type StubEntry = PayrollEntry & {
  employee_name: string;
  employee_code: string | null;
  employee_payroll_type: string;
  phone_allowance: number;
  vacation_rate: number | null;
};

/** A YTD row: any saved entry for the employee, with its week (both read with
 *  "*" — pay_date (0158) can't be named until that migration runs). */
export type YtdEntry = Pick<PayrollEntry, "employee_id"> &
  Partial<PayrollEntry> & {
    pay_date?: string | null;
    payroll_weeks?: { week_start: string; week_end?: string | null; pay_date?: string | null } | null;
  };

/**
 * The year an entry's pay counts toward (T4s go by the date it's paid): the
 * entry's pay date → its week's → the week's last day. A week running into
 * January, or paid in January, belongs to the new year.
 */
export function payYear(
  entryPayDate: string | null | undefined,
  week: { week_start: string; week_end?: string | null; pay_date?: string | null },
): string {
  return (entryPayDate || week.pay_date || week.week_end || week.week_start).slice(0, 4);
}

export interface StubEmployeeInfo {
  sin_last4: string | null;
  hire_date: string | null;
}

export interface StubLine {
  label: string;
  hours?: string;
  rate?: number;
  current: number;
  ytd: number;
}

export interface StubPayment {
  date: string;
  method: string;
  reference: string | null;
  amount: number;
}

export interface PayStub {
  entryId: string;
  employer: {
    name: string;
    location: string;
    address: string | null;
    phone: string | null;
    businessNumber: string | null;
  };
  employee: {
    name: string;
    code: string | null;
    type: string;
    sin: string | null;
    hireDate: string | null;
  };
  periodStart: string;
  periodEnd: string;
  periodWeeks: number;
  /** Entry pay date, else the week's; null when neither is set. */
  payDate: string | null;
  chequeNo: string | null;
  /** Only "approved" / "paid" — a draft status never prints on a stub. */
  status: "approved" | "paid" | null;
  /** How the pay went out: the recorded payments' tenders, else "Cheque"
   *  when a cheque number is on the entry. */
  paymentMethod: string | null;
  payments: StubPayment[];
  /** First day of the YTD window (Jan 1 of the period's year). */
  ytdFrom: string;
  earnings: StubLine[];
  gross: { current: number; ytd: number } | null;
  deductions: StubLine[];
  totalDeductions: { current: number; ytd: number };
  net: { current: number; ytd: number } | null;
  vacation: { current: number; ytd: number; ratePct: string | null } | null;
  employerContributions: StubLine[];
  cashPaid: number;
  chequePortion: number;
  exemptions: string[];
  notes: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const n = (v: unknown) => Number(v ?? 0) || 0;

/** The business number alone — "RT 0001" is the HST account suffix, the
 *  same strip the invoice header does (client 2026-10-20). */
export function businessNumber(hst: string | null | undefined): string | null {
  const bn = (hst ?? "").replace(/\s*RT\s*\d+\s*$/i, "").trim();
  return bn || null;
}

/** A SIN from its last four digits, in the 3-3-3 grouping it is printed in. */
export function maskedSin(last4: string | null | undefined): string | null {
  const d = (last4 ?? "").replace(/\D/g, "");
  if (d.length !== 4) return null;
  return `***-**${d[0]}-${d.slice(1)}`;
}

const hrs = (h: number) => `${Math.round(h * 100) / 100}`;

export function assemblePayStubs(args: {
  week: StubWeek;
  /** app_settings.company_name — used when the shop has no invoice name. */
  companyName: string;
  /** These employees' entries up to this week (inclusive), from early enough
   *  to cover the tax year; each is counted in the year payYear gives it. */
  ytdEntries: YtdEntry[];
  employees: Map<string, StubEmployeeInfo>;
  show: (columnKey: string) => boolean;
  /** One entry only; omit for the whole week. */
  entryId?: string | null;
}): PayStub[] {
  const { week, companyName, ytdEntries, employees, show } = args;
  const entries = args.entryId ? week.entries.filter((e) => e.id === args.entryId) : week.entries;
  const status = week.status === "approved" || week.status === "paid" ? week.status : null;

  return entries.map((entry) => {
    // The YTD set always holds this entry — even if the YTD read missed it.
    const year = payYear(entry.pay_date, week);
    const mine = ytdEntries.filter(
      (r) =>
        r.employee_id === entry.employee_id &&
        r.id !== entry.id &&
        r.payroll_weeks != null &&
        payYear(r.pay_date, r.payroll_weeks) === year,
    );
    const rows: YtdEntry[] = [...mine, entry];
    const ytd = (fn: (r: YtdEntry) => number) => round2(rows.reduce((s, r) => s + fn(r), 0));
    const line = (
      label: string,
      current: number,
      ytdValue: number,
      extra: Partial<StubLine> = {},
    ): StubLine => ({ label, current: round2(current), ytd: ytdValue, ...extra });
    // A line that's 0 this period AND all year is noise on the stub.
    const any = (l: StubLine) => l.current !== 0 || l.ytd !== 0;

    const earnings: StubLine[] = [];
    earnings.push(
      line(
        "Regular",
        entry.gross_wages,
        ytd((r) => n(r.gross_wages)),
        show("hours") ? { hours: hrs(entry.hours), rate: entry.rate } : {},
      ),
    );
    if (show("overtime")) {
      const ot = line(
        "Overtime",
        entry.overtime_wages,
        ytd((r) => n(r.overtime_wages)),
        entry.overtime_hours > 0 ? { hours: hrs(entry.overtime_hours), rate: entry.overtime_rate } : {},
      );
      if (any(ot)) earnings.push(ot);
    }
    if (show("holiday_vacation")) {
      const hol = line(
        "Statutory holiday",
        entry.holiday_pay,
        ytd((r) => n(r.holiday_pay)),
        entry.holiday_hours > 0
          ? { hours: hrs(entry.holiday_hours), rate: entry.holiday_rate || entry.rate }
          : {},
      );
      if (any(hol)) earnings.push(hol);
    }
    const bonus = line("Bonus", entry.bonus, ytd((r) => n(r.bonus)));
    if (any(bonus)) earnings.push(bonus);
    if (show("phone_allowance")) {
      const phone = line("Phone allowance", entry.phone_allowance, ytd((r) => n(r.phone_allowance)));
      if (any(phone)) earnings.push(phone);
    }
    const misc = line("Other taxable", entry.misc_extra, ytd((r) => n(r.misc_extra)));
    if (any(misc)) earnings.push(misc);

    const grossYtd = ytd((r) => payrollGross(r as PayrollEntry));
    const deductionsYtd = ytd((r) => payrollDeductions(r as PayrollEntry));

    const deductions: StubLine[] = [];
    if (show("ei_cpp")) {
      deductions.push(line("EI", entry.ei_employee, ytd((r) => n(r.ei_employee))));
      deductions.push(line("CPP", entry.cpp_employee, ytd((r) => n(r.cpp_employee))));
      const cpp2 = line("CPP2", entry.cpp_employee2, ytd((r) => n(r.cpp_employee2)));
      if (any(cpp2)) deductions.push(cpp2);
    }
    if (show("income_tax")) {
      deductions.push(line("Income tax", entry.income_tax, ytd((r) => n(r.income_tax))));
    }
    const benefits = line(
      "Benefits",
      entry.benefit_employee_deduction,
      ytd((r) => n(r.benefit_employee_deduction)),
    );
    if (any(benefits)) deductions.push(benefits);

    const employerContributions: StubLine[] = [];
    if (show("benefits")) {
      employerContributions.push(line("EI (employer)", entry.ei_employer, ytd((r) => n(r.ei_employer))));
      employerContributions.push(
        line(
          "CPP (employer)",
          n(entry.cpp_employer) + n(entry.cpp_employer2),
          ytd((r) => n(r.cpp_employer) + n(r.cpp_employer2)),
        ),
      );
      const wsib = line("WSIB", entry.wsib_employer, ytd((r) => n(r.wsib_employer)));
      if (any(wsib)) employerContributions.push(wsib);
      // Same column gate as the CSV export's employer_benefit.
      const erBenefits = line(
        "Benefits (employer)",
        entry.benefit_employer_contribution,
        ytd((r) => n(r.benefit_employer_contribution)),
      );
      if (any(erBenefits)) employerContributions.push(erBenefits);
    }

    const payments: StubPayment[] = week.payments
      .filter((p) => p.employee_id === entry.employee_id)
      .map((p) => ({
        date: p.paid_on,
        method: paymentModeLabel(p.mode),
        reference: p.transaction_id,
        amount: Number(p.amount),
      }));
    const methods = [...new Set(payments.map((p) => p.method))];
    const paymentMethod = methods.length > 0 ? methods.join(", ") : entry.cheque_no ? "Cheque" : null;

    const info = employees.get(entry.employee_id);
    // Entries saved before 0158 carry no rate; work it back from the amount.
    const rate = entry.vacation_rate ?? inferVacationRate(entry);

    return {
      entryId: entry.id,
      employer: {
        name: week.location_invoice_name || companyName,
        location: week.location_name,
        address: week.location_address,
        phone: week.location_phone,
        businessNumber: businessNumber(week.location_hst_number),
      },
      employee: {
        name: entry.employee_name,
        code: entry.employee_code,
        type: entry.employee_payroll_type,
        sin: maskedSin(info?.sin_last4),
        hireDate: info?.hire_date ?? null,
      },
      periodStart: week.week_start,
      periodEnd: week.week_end,
      periodWeeks: week.period_weeks,
      payDate: entry.pay_date || week.pay_date || null,
      chequeNo: entry.cheque_no ?? null,
      status,
      paymentMethod,
      payments,
      ytdFrom: `${year}-01-01`,
      earnings,
      gross: show("gross") ? { current: payrollGross(entry), ytd: grossYtd } : null,
      deductions,
      totalDeductions: { current: payrollDeductions(entry), ytd: deductionsYtd },
      net: show("net_pay") ? { current: round2(entry.net_pay), ytd: ytd((r) => n(r.net_pay)) } : null,
      vacation: show("holiday_vacation")
        ? {
            current: round2(entry.vacation_pay),
            ytd: ytd((r) => n(r.vacation_pay)),
            ratePct:
              entry.apply_vacation === false
                ? null
                : rate != null
                  ? `${Math.round(rate * 10000) / 100}%`
                  : null,
          }
        : null,
      employerContributions,
      cashPaid: n(entry.cash_total),
      chequePortion: n(entry.cheque_amount),
      exemptions: deductionExemptions(entry),
      notes: entry.notes,
    };
  });
}
