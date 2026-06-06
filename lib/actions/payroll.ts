"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  EmployeeInput,
  PayrollCashDailyInput,
  PayrollEntryInput,
  PayrollPaymentInput,
  PayrollWeekInput,
  UpdateEmployeeInput,
  UpdatePayrollEntryInput,
  UpdatePayrollWeekStatusInput,
} from "@/lib/schemas/payroll";
import type {
  Employee,
  PayrollCashDaily,
  PayrollEntry,
  PayrollPayment,
  PayrollWeek,
  StatutoryRate,
} from "@/lib/db/types";
import { computeStatutoryDeductions as _computeStatutoryDeductions } from "@/lib/utils/payroll-math";

// ============================================================================
// Payroll settings — vacation pay rate + WSIB rate. Stored on app_settings
// (singleton id=1), but edited from the Payroll page (they are a payroll
// concern, moved out of the Pricing settings card — client 2026-06).
// Rates are stored as fractions (0.04 = 4%). Owner / co_owner only.
// ============================================================================

const PayrollSettingsInput = z.object({
  vacation_pay_rate: z.coerce.number().min(0).max(1),
  wsib_rate: z.coerce.number().min(0).max(1),
});

export const updatePayrollSettings = wrapAction({
  schema: PayrollSettingsInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({
        vacation_pay_rate: input.vacation_pay_rate,
        wsib_rate: input.wsib_rate,
      })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/payroll");
    return { ok: true };
  },
});

// ============================================================================
// Employees
// ============================================================================

export async function listEmployees(locationId?: string): Promise<Employee[]> {
  const supabase = await createClient();
  let q = supabase.from("employees").select("*").eq("active", true).order("full_name");
  if (locationId) q = q.eq("location_id", locationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Employee[];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
  if (error) return null;
  return data as Employee;
}

export const createEmployee = wrapAction({
  schema: EmployeeInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<Employee> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("employees")
      .insert({
        ...input,
        code: input.code?.trim() || null,
        sin_last4: input.sin_last4 || null,
        hire_date: input.hire_date || null,
        termination_date: input.termination_date || null,
        location_id: input.location_id ?? profile.location_id,
        notes: input.notes || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/payroll");
    return data as Employee;
  },
});

export const updateEmployee = wrapAction({
  schema: UpdateEmployeeInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<Employee> => {
    const supabase = await createClient();
    const { id, code, ...rest } = input;
    const codeUpdate = code?.trim() ? { code: code.trim() } : {};
    const { data, error } = await supabase
      .from("employees")
      .update({ ...rest, ...codeUpdate, sin_last4: rest.sin_last4 || null, notes: rest.notes || null, updated_by: profile.id })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/payroll");
    return data as Employee;
  },
});

// ============================================================================
// Statutory rates
// ============================================================================

export async function getStatutoryRatesForYear(year: number): Promise<StatutoryRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("statutory_rates")
    .select("*")
    .eq("year", year);
  if (error) throw error;
  return (data ?? []) as StatutoryRate[];
}

// ============================================================================
// Payroll weeks
// ============================================================================

export interface PayrollWeekWithLocation extends PayrollWeek {
  location_name: string;
  location_code: string;
  entry_count: number;
  // Per-week rollups (sum across all entries in the week)
  total_gross: number;
  total_net: number;
  total_deductions: number;
  total_employer_cost: number;   // EI/CPP employer + WSIB + employer benefits + vacation
  total_vacation_pay: number;
  total_cash: number;
  total_paid: number;            // sum of payroll_payments.amount
}

export async function listPayrollWeeks(locationId?: string): Promise<PayrollWeekWithLocation[]> {
  const supabase = await createClient();
  let q = supabase
    .from("payroll_weeks")
    .select(
      `*,
       locations(name, code),
       payroll_entries(
         gross_wages, overtime_wages, bonus, misc_extra, holiday_pay,
         ei_employee, cpp_employee, cpp_employee2, income_tax,
         benefit_employee_deduction, benefit_employer_contribution,
         ei_employer, cpp_employer, cpp_employer2, wsib_employer,
         vacation_pay, cash_total, net_pay
       ),
       payroll_payments(amount)`,
    )
    .order("week_start", { ascending: false })
    .limit(52);
  if (locationId) q = q.eq("location_id", locationId);
  const { data, error } = await q;
  if (error) throw error;
  type EntryShape = {
    gross_wages: number;
    overtime_wages: number;
    bonus: number;
    misc_extra: number;
    holiday_pay: number;
    ei_employee: number;
    cpp_employee: number;
    cpp_employee2: number;
    income_tax: number;
    benefit_employee_deduction: number;
    benefit_employer_contribution: number;
    ei_employer: number;
    cpp_employer: number;
    cpp_employer2: number;
    wsib_employer: number;
    vacation_pay: number;
    cash_total: number;
    net_pay: number;
  };
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    const loc = row.locations as { name: string; code: string } | null;
    const entries = (row.payroll_entries as EntryShape[]) ?? [];
    const payments = (row.payroll_payments as { amount: number }[]) ?? [];
    const sum = (key: keyof EntryShape) =>
      entries.reduce((s, e) => s + Number(e[key] ?? 0), 0);
    const totalGross = entries.reduce(
      (s, e) =>
        s
        + Number(e.gross_wages)
        + Number(e.overtime_wages)
        + Number(e.bonus)
        + Number(e.holiday_pay)
        + Number(e.misc_extra),
      0,
    );
    const totalDeductions =
      sum("ei_employee")
      + sum("cpp_employee")
      + sum("cpp_employee2")
      + sum("income_tax")
      + sum("benefit_employee_deduction");
    const totalEmployerCost =
      sum("ei_employer")
      + sum("cpp_employer")
      + sum("cpp_employer2")
      + sum("wsib_employer")
      + sum("benefit_employer_contribution")
      + sum("vacation_pay");
    return {
      ...(row as unknown as PayrollWeek),
      location_name: loc?.name ?? "",
      location_code: loc?.code ?? "",
      entry_count: entries.length,
      total_gross: totalGross,
      total_net: sum("net_pay"),
      total_deductions: totalDeductions,
      total_employer_cost: totalEmployerCost,
      total_vacation_pay: sum("vacation_pay"),
      total_cash: sum("cash_total"),
      total_paid: payments.reduce((s, p) => s + Number(p.amount), 0),
    };
  });
}

export interface PayrollWeekDetail extends PayrollWeek {
  location_name: string;
  location_code: string;
  entries: PayrollEntryWithEmployee[];
  payments: PayrollPayment[];
}

export interface PayrollEntryWithEmployee extends PayrollEntry {
  employee_name: string;
  employee_payroll_type: string;
  cash_days: PayrollCashDaily[];
}

export async function getPayrollWeek(weekId: string): Promise<PayrollWeekDetail | null> {
  const supabase = await createClient();

  const { data: week, error: weekErr } = await supabase
    .from("payroll_weeks")
    .select("*, locations(name, code)")
    .eq("id", weekId)
    .single();
  if (weekErr || !week) return null;

  const { data: entries, error: entriesErr } = await supabase
    .from("payroll_entries")
    .select("*, employees(full_name, payroll_type), payroll_cash_daily(*)")
    .eq("payroll_week_id", weekId)
    .order("created_at");
  if (entriesErr) throw entriesErr;

  const { data: payments, error: paymentsErr } = await supabase
    .from("payroll_payments")
    .select("*")
    .eq("payroll_week_id", weekId)
    .order("paid_on");
  if (paymentsErr) throw paymentsErr;

  const loc = (week as unknown as { locations: { name: string; code: string } }).locations;

  return {
    ...(week as unknown as PayrollWeek),
    location_name: loc?.name ?? "",
    location_code: loc?.code ?? "",
    entries: ((entries ?? []) as unknown[]).map((e) => {
      const row = e as Record<string, unknown>;
      const emp = row.employees as { full_name: string; payroll_type: string } | null;
      const cashDays = (row.payroll_cash_daily as PayrollCashDaily[]) ?? [];
      return {
        ...(row as unknown as PayrollEntry),
        employee_name: emp?.full_name ?? "",
        employee_payroll_type: emp?.payroll_type ?? "employee",
        cash_days: cashDays,
      };
    }),
    payments: (payments ?? []) as PayrollPayment[],
  };
}

/** Snap a YYYY-MM-DD to the Monday of its week (UTC). Server-side safety net
 *  for the DB's `payroll_weeks_start_is_monday` constraint — the client form
 *  also snaps but a stale form / API caller could still send a non-Monday. */
function snapToMonday(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  const dow = date.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export const createPayrollWeek = wrapAction({
  schema: PayrollWeekInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<PayrollWeek> => {
    const supabase = await createClient();
    const weekStart = snapToMonday(input.week_start);
    const { data, error } = await supabase
      .from("payroll_weeks")
      .insert({
        location_id: input.location_id,
        week_start: weekStart,
        notes: input.notes || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/payroll");
    return data as PayrollWeek;
  },
});

export const updatePayrollWeekStatus = wrapAction({
  schema: UpdatePayrollWeekStatusInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<PayrollWeek> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payroll_weeks")
      .update({ status: input.status, updated_by: profile.id })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/payroll/${input.id}`);
    revalidatePath("/payroll");
    return data as PayrollWeek;
  },
});

// ============================================================================
// Payroll entries
// ============================================================================

/**
 * Build the full payload (computed fields + raw inputs) for a payroll entry.
 *
 * One source of truth for upsert + update so we never drift on overtime,
 * vacation, employer EI/CPP, or WSIB.
 */
async function buildEntryPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: PayrollEntryInput,
) {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const regularWages = round2(input.hours * input.rate);
  const overtimeWages = round2(input.overtime_hours * input.overtime_rate);
  const grossWages = round2(regularWages + overtimeWages);

  // Look up the year + vacation/WSIB rates
  const [{ data: weekRow }, { data: settings }] = await Promise.all([
    supabase
      .from("payroll_weeks")
      .select("week_start")
      .eq("id", input.payroll_week_id)
      .single(),
    supabase
      .from("app_settings")
      .select("vacation_pay_rate, wsib_rate")
      .eq("id", 1)
      .single(),
  ]);
  const year = weekRow ? new Date(weekRow.week_start).getFullYear() : new Date().getFullYear();
  const vacationRate = Number(settings?.vacation_pay_rate ?? 0.04);
  const wsibRate = Number(settings?.wsib_rate ?? 0);

  // Vacation accrual = % of (gross wages + OT + bonus + holiday pay)
  const vacationPay = round2(
    (grossWages + input.bonus + input.holiday_pay) * vacationRate,
  );

  // Insurable earnings drive EI + CPP; holiday pay + bonus + OT are insurable;
  // misc_extra is taxable but NOT insurable (per current convention).
  const insurable = round2(grossWages + input.bonus + input.holiday_pay);

  const rates = await getStatutoryRatesForYear(year);
  const {
    ei,
    cpp,
    cpp2,
    ei_employer,
    cpp_employer,
    cpp_employer2,
  } = _computeStatutoryDeductions(insurable, rates, year);

  const wsibEmployer = round2(insurable * wsibRate);

  const netPay = round2(
    grossWages
      + input.bonus
      + input.holiday_pay
      + input.misc_extra
      - ei
      - cpp
      - cpp2
      - input.income_tax
      - input.benefit_employee_deduction,
  );

  return {
    payroll_week_id: input.payroll_week_id,
    employee_id: input.employee_id,
    hours: input.hours,
    rate: input.rate,
    gross_wages: regularWages,
    overtime_hours: input.overtime_hours,
    overtime_rate: input.overtime_rate,
    overtime_wages: overtimeWages,
    holiday_pay: input.holiday_pay,
    vacation_pay: vacationPay,
    bonus: input.bonus,
    misc_extra: input.misc_extra,
    insurable_earnings: insurable,
    ei_employee: ei,
    cpp_employee: cpp,
    cpp_employee2: cpp2,
    income_tax: input.income_tax,
    ei_employer,
    cpp_employer,
    cpp_employer2,
    wsib_employer: wsibEmployer,
    benefit_employee_deduction: input.benefit_employee_deduction,
    benefit_employer_contribution: input.benefit_employer_contribution,
    cheque_amount: input.cheque_amount,
    net_pay: netPay,
    notes: input.notes || null,
  };
}

export const upsertPayrollEntry = wrapAction({
  schema: PayrollEntryInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<PayrollEntry> => {
    const supabase = await createClient();
    const payload = await buildEntryPayload(supabase, input);

    const { data, error } = await supabase
      .from("payroll_entries")
      .upsert(
        { ...payload, created_by: profile.id, updated_by: profile.id },
        { onConflict: "payroll_week_id,employee_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/payroll/${input.payroll_week_id}`);
    return data as PayrollEntry;
  },
});

export const updatePayrollEntry = wrapAction({
  schema: UpdatePayrollEntryInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<PayrollEntry> => {
    const supabase = await createClient();
    const { id, ...rest } = input;
    const payload = await buildEntryPayload(supabase, rest);

    const { data, error } = await supabase
      .from("payroll_entries")
      .update({ ...payload, updated_by: profile.id })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/payroll/${rest.payroll_week_id}`);
    return data as PayrollEntry;
  },
});

// ============================================================================
// Cash daily (management)
// ============================================================================

export const upsertCashDaily = wrapAction({
  schema: PayrollCashDailyInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<PayrollCashDaily> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payroll_cash_daily")
      .upsert(
        { ...input, notes: input.notes || null, created_by: profile.id },
        { onConflict: "payroll_entry_id,day" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data as PayrollCashDaily;
  },
});

// ============================================================================
// Payroll payments
// ============================================================================

export const addPayrollPayment = wrapAction({
  schema: PayrollPaymentInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<PayrollPayment> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payroll_payments")
      .insert({ ...input, notes: input.notes || null, transaction_id: input.transaction_id || null, created_by: profile.id })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/payroll/${input.payroll_week_id}`);
    return data as PayrollPayment;
  },
});
