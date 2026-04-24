"use server";

import { revalidatePath } from "next/cache";

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
  roles: ["owner", "manager"],
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
  roles: ["owner", "manager"],
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
}

export async function listPayrollWeeks(locationId?: string): Promise<PayrollWeekWithLocation[]> {
  const supabase = await createClient();
  let q = supabase
    .from("payroll_weeks")
    .select(`*, locations(name, code), payroll_entries(count)`)
    .order("week_start", { ascending: false })
    .limit(52);
  if (locationId) q = q.eq("location_id", locationId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    const loc = row.locations as { name: string; code: string } | null;
    const entries = row.payroll_entries as { count: string }[] | null;
    return {
      ...(row as unknown as PayrollWeek),
      location_name: loc?.name ?? "",
      location_code: loc?.code ?? "",
      entry_count: Number(entries?.[0]?.count ?? 0),
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

export const createPayrollWeek = wrapAction({
  schema: PayrollWeekInput,
  roles: ["owner", "manager"],
  handler: async (input, profile): Promise<PayrollWeek> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payroll_weeks")
      .insert({
        location_id: input.location_id,
        week_start: input.week_start,
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
  roles: ["owner", "manager"],
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

export const upsertPayrollEntry = wrapAction({
  schema: PayrollEntryInput,
  roles: ["owner", "manager"],
  handler: async (input, profile): Promise<PayrollEntry> => {
    const supabase = await createClient();

    const grossWages = Math.round(input.hours * input.rate * 100) / 100;
    const insurable = Math.round((grossWages + input.bonus) * 100) / 100;

    // Look up statutory rates for the week's year
    const { data: weekRow } = await supabase
      .from("payroll_weeks")
      .select("week_start")
      .eq("id", input.payroll_week_id)
      .single();
    const year = weekRow ? new Date(weekRow.week_start).getFullYear() : new Date().getFullYear();

    const rates = await getStatutoryRatesForYear(year);
    const { ei, cpp } = _computeStatutoryDeductions(insurable, rates, year);

    const netPay = Math.round(
      (grossWages + input.bonus + input.misc_extra
        - ei - cpp - input.income_tax
        - input.benefit_employee_deduction) * 100
    ) / 100;

    const payload = {
      payroll_week_id: input.payroll_week_id,
      employee_id: input.employee_id,
      hours: input.hours,
      rate: input.rate,
      gross_wages: grossWages,
      bonus: input.bonus,
      misc_extra: input.misc_extra,
      insurable_earnings: insurable,
      ei_employee: ei,
      cpp_employee: cpp,
      income_tax: input.income_tax,
      benefit_employee_deduction: input.benefit_employee_deduction,
      benefit_employer_contribution: input.benefit_employer_contribution,
      cheque_amount: input.cheque_amount,
      net_pay: netPay,
      notes: input.notes || null,
      updated_by: profile.id,
    };

    const { data, error } = await supabase
      .from("payroll_entries")
      .upsert({ ...payload, created_by: profile.id }, { onConflict: "payroll_week_id,employee_id" })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/payroll/${input.payroll_week_id}`);
    return data as PayrollEntry;
  },
});

export const updatePayrollEntry = wrapAction({
  schema: UpdatePayrollEntryInput,
  roles: ["owner", "manager"],
  handler: async (input, profile): Promise<PayrollEntry> => {
    const supabase = await createClient();
    const { id, ...rest } = input;

    const grossWages = Math.round(rest.hours * rest.rate * 100) / 100;
    const insurable = Math.round((grossWages + rest.bonus) * 100) / 100;

    const { data: weekRow } = await supabase
      .from("payroll_weeks")
      .select("week_start")
      .eq("id", rest.payroll_week_id)
      .single();
    const year = weekRow ? new Date(weekRow.week_start).getFullYear() : new Date().getFullYear();
    const rates = await getStatutoryRatesForYear(year);
    const { ei, cpp } = _computeStatutoryDeductions(insurable, rates, year);

    const netPay = Math.round(
      (grossWages + rest.bonus + rest.misc_extra - ei - cpp - rest.income_tax - rest.benefit_employee_deduction) * 100
    ) / 100;

    const { data, error } = await supabase
      .from("payroll_entries")
      .update({
        hours: rest.hours, rate: rest.rate, gross_wages: grossWages,
        bonus: rest.bonus, misc_extra: rest.misc_extra,
        insurable_earnings: insurable, ei_employee: ei, cpp_employee: cpp,
        income_tax: rest.income_tax,
        benefit_employee_deduction: rest.benefit_employee_deduction,
        benefit_employer_contribution: rest.benefit_employer_contribution,
        cheque_amount: rest.cheque_amount,
        net_pay: netPay, notes: rest.notes || null, updated_by: profile.id,
      })
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
  roles: ["owner", "manager"],
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
  roles: ["owner", "manager"],
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
