"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import { REFERENCE_TAGS, revalidateReference } from "@/lib/cache/reference";
import {
  EmployeeInput,
  PayrollCashDailyInput,
  PayrollEntryInput,
  PayrollPaymentInput,
  PayrollIdInput,
  PayrollWeekInput,
  UpdateEmployeeInput,
  UpdatePayrollEntryInput,
  UpdatePayrollPaymentInput,
  UpdatePayrollWeekInput,
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
    revalidateReference(REFERENCE_TAGS.appSettings);
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

export interface EmployeeWithLinks extends Employee {
  location_name: string | null;
  /** Display name of the linked login user (profiles.full_name), if any. */
  linked_user_name: string | null;
}

/** All employees (active + inactive) for the management table. */
export async function listAllEmployees(): Promise<EmployeeWithLinks[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*, locations:location_id(name), profiles:profile_id(full_name, username)")
    .order("active", { ascending: false })
    .order("full_name");
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    const loc = row.locations as { name: string | null } | null;
    const prof = row.profiles as { full_name: string | null; username: string | null } | null;
    const rest = { ...row };
    delete rest.locations;
    delete rest.profiles;
    return {
      ...(rest as unknown as Employee),
      location_name: loc?.name ?? null,
      linked_user_name: prof?.full_name ?? prof?.username ?? null,
    };
  });
}

/** Login users an employee can be linked to (for the "My Pay" view). RLS scopes
 *  the visible set: managers see their own location, owner/co_owner/accountant
 *  see everyone. Portal customers are never linkable. */
export interface LinkableProfile {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
}

export async function listLinkableProfiles(): Promise<LinkableProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, role")
    .eq("active", true)
    .neq("role", "portal_customer")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as LinkableProfile[];
}

const ToggleEmployeeActive = z.object({
  id: z.string().uuid(),
  active: z.coerce.boolean(),
});

export const toggleEmployeeActive = wrapAction({
  schema: ToggleEmployeeActive,
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<Employee> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("employees")
      .update({ active: input.active, updated_by: profile.id })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/payroll/employees");
    return data as Employee;
  },
});

// ============================================================================
// My Pay — staff-facing read of their OWN pay. Backed by the SECURITY DEFINER
// function public.get_my_pay() (migration 0094), which returns only rows for
// the employee linked to the calling user (employees.profile_id = auth.uid()).
// ============================================================================

export interface MyPayRow {
  week_id: string;
  week_start: string;
  week_end: string;
  status: string;
  location_name: string | null;
  gross_wages: number;
  overtime_wages: number;
  bonus: number;
  holiday_pay: number;
  misc_extra: number;
  ei_employee: number;
  cpp_employee: number;
  cpp_employee2: number;
  income_tax: number;
  benefit_employee_deduction: number;
  vacation_pay: number;
  cash_total: number;
  net_pay: number;
  paid: number;
}

export async function getMyPay(): Promise<MyPayRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_pay");
  if (error) throw error;
  return ((data ?? []) as MyPayRow[]).map((r) => ({
    ...r,
    gross_wages: Number(r.gross_wages),
    overtime_wages: Number(r.overtime_wages),
    bonus: Number(r.bonus),
    holiday_pay: Number(r.holiday_pay),
    misc_extra: Number(r.misc_extra),
    ei_employee: Number(r.ei_employee),
    cpp_employee: Number(r.cpp_employee),
    cpp_employee2: Number(r.cpp_employee2),
    income_tax: Number(r.income_tax),
    benefit_employee_deduction: Number(r.benefit_employee_deduction),
    vacation_pay: Number(r.vacation_pay),
    cash_total: Number(r.cash_total),
    net_pay: Number(r.net_pay),
    paid: Number(r.paid),
  }));
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
  if (error) return null;
  return data as Employee;
}

export const createEmployee = wrapAction({
  schema: EmployeeInput,
  roles: ["owner", "co_owner", "manager", "accountant"],
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
        profile_id: input.profile_id || null,
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
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<Employee> => {
    const supabase = await createClient();
    const { id, code, ...rest } = input;
    const codeUpdate = code?.trim() ? { code: code.trim() } : {};
    const { data, error } = await supabase
      .from("employees")
      .update({ ...rest, ...codeUpdate, sin_last4: rest.sin_last4 || null, profile_id: rest.profile_id || null, notes: rest.notes || null, updated_by: profile.id })
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
  /** Printed-document header fields for this shop (see the print view). */
  location_address: string | null;
  location_phone: string | null;
  location_invoice_name: string | null;
  entries: PayrollEntryWithEmployee[];
  payments: PayrollPayment[];
}

export interface PayrollEntryWithEmployee extends PayrollEntry {
  employee_name: string;
  employee_code: string | null;
  employee_payroll_type: string;
  cash_days: PayrollCashDaily[];
}

export async function getPayrollWeek(weekId: string): Promise<PayrollWeekDetail | null> {
  const supabase = await createClient();

  const { data: week, error: weekErr } = await supabase
    .from("payroll_weeks")
    .select("*, locations(name, code, address, phone, invoice_name)")
    .eq("id", weekId)
    .single();
  if (weekErr || !week) return null;

  const { data: entries, error: entriesErr } = await supabase
    .from("payroll_entries")
    .select("*, employees(full_name, code, payroll_type), payroll_cash_daily(*)")
    .eq("payroll_week_id", weekId)
    .order("created_at");
  if (entriesErr) throw entriesErr;

  const { data: payments, error: paymentsErr } = await supabase
    .from("payroll_payments")
    .select("*")
    .eq("payroll_week_id", weekId)
    .order("paid_on");
  if (paymentsErr) throw paymentsErr;

  const loc = (week as unknown as {
    locations: {
      name: string;
      code: string;
      address: string | null;
      phone: string | null;
      invoice_name: string | null;
    };
  }).locations;

  return {
    ...(week as unknown as PayrollWeek),
    location_name: loc?.name ?? "",
    location_code: loc?.code ?? "",
    location_address: loc?.address ?? null,
    location_phone: loc?.phone ?? null,
    location_invoice_name: loc?.invoice_name ?? null,
    entries: ((entries ?? []) as unknown[]).map((e) => {
      const row = e as Record<string, unknown>;
      const emp = row.employees as {
        full_name: string;
        code: string | null;
        payroll_type: string;
      } | null;
      const cashDays = (row.payroll_cash_daily as PayrollCashDaily[]) ?? [];
      return {
        ...(row as unknown as PayrollEntry),
        employee_name: emp?.full_name ?? "",
        employee_code: emp?.code ?? null,
        employee_payroll_type: emp?.payroll_type ?? "employee",
        cash_days: cashDays,
      };
    }),
    payments: (payments ?? []) as PayrollPayment[],
  };
}

/** Snap a YYYY-MM-DD to the Sunday of its week (UTC). Server-side safety net for
 *  the DB's `payroll_weeks_start_is_sunday` check — the client form also snaps,
 *  but a stale form / API caller could still send a non-Sunday. */
function snapToSunday(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  const dow = date.getUTCDay(); // 0 = Sunday
  date.setUTCDate(date.getUTCDate() - dow); // shift back to Sunday
  return date.toISOString().slice(0, 10);
}

export const createPayrollWeek = wrapAction({
  schema: PayrollWeekInput,
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<PayrollWeek> => {
    const supabase = await createClient();
    const weekStart = snapToSunday(input.week_start);
    const { data, error } = await supabase
      .from("payroll_weeks")
      .insert({
        location_id: input.location_id,
        week_start: weekStart,
        period_weeks: input.period_weeks,
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
  roles: ["owner", "co_owner", "manager", "accountant"],
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

/** Roles allowed to run the payroll workflow. Mirrors the RLS rule in 0134 —
 *  managers are additionally scoped to their own location by the policy. */
const PAYROLL_ROLES = ["owner", "co_owner", "manager", "accountant"] as const;

export const updatePayrollWeek = wrapAction({
  schema: UpdatePayrollWeekInput,
  roles: [...PAYROLL_ROLES],
  handler: async (input, profile): Promise<PayrollWeek> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payroll_weeks")
      .update({
        location_id: input.location_id,
        week_start: snapToSunday(input.week_start),
        period_weeks: input.period_weeks,
        notes: input.notes || null,
        updated_by: profile.id,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/payroll/${input.id}`);
    revalidatePath("/payroll");
    return data as PayrollWeek;
  },
});

/**
 * Delete a whole pay week — for weeks opened on the wrong date or the wrong
 * shop. payroll_entries.payroll_week_id is `on delete restrict`, so the children
 * come out first, deliberately and in order: payments, then entries (their daily
 * cash rows cascade off the entry), then the week itself.
 */
export const deletePayrollWeek = wrapAction({
  schema: PayrollIdInput,
  roles: [...PAYROLL_ROLES],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();

    const { error: payErr } = await supabase
      .from("payroll_payments")
      .delete()
      .eq("payroll_week_id", input.id);
    if (payErr) throw payErr;

    const { error: entryErr } = await supabase
      .from("payroll_entries")
      .delete()
      .eq("payroll_week_id", input.id);
    if (entryErr) throw entryErr;

    const { error } = await supabase.from("payroll_weeks").delete().eq("id", input.id);
    if (error) throw error;

    revalidatePath("/payroll");
    return { ok: true };
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

  // Holiday pay is hours × rate (0136), not a typed amount. Hours entered with
  // no holiday rate fall back to the person's regular rate — stat hours at $0
  // is never what anyone meant, and the form pre-fills the same way.
  const holidayRate = input.holiday_rate > 0 ? input.holiday_rate : input.rate;
  const holidayPay = round2(input.holiday_hours * holidayRate);

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
  const vacationPay = input.apply_vacation
    ? round2((grossWages + input.bonus + holidayPay) * vacationRate)
    : 0;

  // Insurable earnings drive EI + CPP; holiday pay + bonus + OT are insurable;
  // misc_extra is taxable but NOT insurable (per current convention).
  const insurable = round2(grossWages + input.bonus + holidayPay);

  const rates = await getStatutoryRatesForYear(year);
  const computed = _computeStatutoryDeductions(insurable, rates, year);

  // Optional statutory items (0135). A flag that is off zeroes the employee
  // amount AND the employer side that mirrors it — an EI-exempt employee costs
  // the shop no employer EI. CPP off takes CPP2 with it: someone exempt from
  // tier 1 (under 18, over 70, CPT30) is exempt from tier 2 by definition.
  const applyCpp2 = input.apply_cpp && input.apply_cpp2;

  const ei = input.apply_ei ? computed.ei : 0;
  const ei_employer = input.apply_ei ? computed.ei_employer : 0;
  const cpp = input.apply_cpp ? computed.cpp : 0;
  const cpp_employer = input.apply_cpp ? computed.cpp_employer : 0;
  const cpp2 = applyCpp2 ? computed.cpp2 : 0;
  const cpp_employer2 = applyCpp2 ? computed.cpp_employer2 : 0;
  const incomeTax = input.apply_income_tax ? input.income_tax : 0;

  const wsibEmployer = input.apply_wsib ? round2(insurable * wsibRate) : 0;

  const netPay = round2(
    grossWages
      + input.bonus
      + holidayPay
      + input.misc_extra
      - ei
      - cpp
      - cpp2
      - incomeTax
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
    holiday_hours: input.holiday_hours,
    holiday_rate: holidayRate,
    holiday_pay: holidayPay,
    vacation_pay: vacationPay,
    bonus: input.bonus,
    misc_extra: input.misc_extra,
    insurable_earnings: insurable,
    ei_employee: ei,
    cpp_employee: cpp,
    cpp_employee2: cpp2,
    income_tax: incomeTax,
    ei_employer,
    cpp_employer,
    cpp_employer2,
    wsib_employer: wsibEmployer,
    benefit_employee_deduction: input.benefit_employee_deduction,
    benefit_employer_contribution: input.benefit_employer_contribution,
    apply_ei: input.apply_ei,
    apply_cpp: input.apply_cpp,
    apply_cpp2: applyCpp2,
    apply_income_tax: input.apply_income_tax,
    apply_vacation: input.apply_vacation,
    apply_wsib: input.apply_wsib,
    cheque_amount: input.cheque_amount,
    net_pay: netPay,
    notes: input.notes || null,
  };
}

export const upsertPayrollEntry = wrapAction({
  schema: PayrollEntryInput,
  roles: ["owner", "co_owner", "manager", "accountant"],
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
  roles: ["owner", "co_owner", "manager", "accountant"],
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

export const deletePayrollEntry = wrapAction({
  schema: PayrollIdInput,
  roles: [...PAYROLL_ROLES],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();
    // Read the parent week first — we need it for revalidation, and a missing
    // row here means RLS hid it, which is a clearer error than a silent no-op.
    const { data: entry, error: readErr } = await supabase
      .from("payroll_entries")
      .select("payroll_week_id")
      .eq("id", input.id)
      .single();
    if (readErr) throw readErr;

    const { error } = await supabase.from("payroll_entries").delete().eq("id", input.id);
    if (error) throw error;
    revalidatePath(`/payroll/${entry.payroll_week_id}`);
    revalidatePath("/payroll");
    return { ok: true };
  },
});

// ============================================================================
// Cash daily (management)
// ============================================================================

export const upsertCashDaily = wrapAction({
  schema: PayrollCashDailyInput,
  roles: ["owner", "co_owner", "manager", "accountant"],
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

export const deleteCashDaily = wrapAction({
  schema: PayrollIdInput,
  roles: [...PAYROLL_ROLES],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { error } = await supabase.from("payroll_cash_daily").delete().eq("id", input.id);
    if (error) throw error;
    // cash_total on the parent entry is re-rolled by trg_cash_daily_rollup.
    return { ok: true };
  },
});

// ============================================================================
// Payroll payments
// ============================================================================

export const addPayrollPayment = wrapAction({
  schema: PayrollPaymentInput,
  roles: ["owner", "co_owner", "manager", "accountant"],
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

export const updatePayrollPayment = wrapAction({
  schema: UpdatePayrollPaymentInput,
  roles: [...PAYROLL_ROLES],
  handler: async (input): Promise<PayrollPayment> => {
    const supabase = await createClient();
    const { id, ...rest } = input;
    const { data, error } = await supabase
      .from("payroll_payments")
      .update({
        ...rest,
        notes: rest.notes || null,
        transaction_id: rest.transaction_id || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/payroll/${rest.payroll_week_id}`);
    revalidatePath("/payroll");
    return data as PayrollPayment;
  },
});

export const deletePayrollPayment = wrapAction({
  schema: PayrollIdInput,
  roles: [...PAYROLL_ROLES],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { data: payment, error: readErr } = await supabase
      .from("payroll_payments")
      .select("payroll_week_id")
      .eq("id", input.id)
      .single();
    if (readErr) throw readErr;

    const { error } = await supabase.from("payroll_payments").delete().eq("id", input.id);
    if (error) throw error;
    revalidatePath(`/payroll/${payment.payroll_week_id}`);
    revalidatePath("/payroll");
    return { ok: true };
  },
});
