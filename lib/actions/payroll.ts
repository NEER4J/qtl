"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { applyLocationFilter } from "@/lib/auth/locations";
import {
  omitKeys,
  writeDroppingPending,
  type PendingColumns,
} from "@/lib/supabase/pending-columns";
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
import {
  computeEntryEarnings,
  computeNetPay,
  computeStatutoryDeductions as _computeStatutoryDeductions,
  inferVacationRate,
  payrollDeductions,
  payrollGross,
  resolveVacationRate,
  rollingYearStart,
} from "@/lib/utils/payroll-math";
import { todayISO } from "@/lib/utils/tz";

// ============================================================================
// Columns from migrations that may not be applied yet (they are run by hand,
// after the code ships): a write naming a missing one drops it and retries —
// see lib/supabase/pending-columns.ts.
// ============================================================================

const NEEDS_0158 = "needs database update 0158, which hasn't been applied yet";

// 0158 (client 2026-10-20): vacation override + pay defaults on the employee.
const EMPLOYEE_PENDING: PendingColumns[] = [
  {
    columns: [
      "vacation_pay_rate",
      "default_hours",
      "default_overtime_hours",
      "default_bonus",
      "default_phone_allowance",
      "default_misc_extra",
      "default_income_tax",
      "default_benefit_employee_deduction",
      "default_benefit_employer_contribution",
    ],
    ifSet: `Saving pay defaults or a vacation override ${NEEDS_0158}. Clear those boxes to save the rest.`,
  },
];

const WEEK_PENDING: PendingColumns[] = [
  { columns: ["pay_date"], ifSet: `Saving the week's pay date ${NEEDS_0158}. Clear it to save the rest.` },
];

const ENTRY_PENDING: PendingColumns[] = [
  // A phone allowance left out of the row would still be in net pay, so a
  // non-zero one stops the save rather than vanishing.
  { columns: ["phone_allowance"], ifSet: `Saving a phone allowance ${NEEDS_0158}. Set it to 0 to save the rest.` },
  // Only a snapshot — vacation_pay itself is already worked out at this rate.
  { columns: ["vacation_rate"] },
  // 0152: cheque number + pay date on the entry.
  { columns: ["cheque_no", "pay_date"] },
];

const PAYMENT_PENDING: PendingColumns[] = [{ columns: ["updated_by"] }];

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
  page: "payroll",
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

export async function listEmployees(
  locationIds?: string[] | null,
): Promise<Employee[]> {
  const supabase = await createClient();
  let q = supabase.from("employees").select("*").eq("active", true).order("full_name");
  q = applyLocationFilter(q, "location_id", locationIds ?? null);
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
  page: "payroll_employees",
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
  /** 0 until get_my_pay is recreated by 0158. */
  phone_allowance: number;
  ei_employee: number;
  cpp_employee: number;
  cpp_employee2: number;
  income_tax: number;
  benefit_employee_deduction: number;
  vacation_pay: number;
  cash_total: number;
  net_pay: number;
  paid: number;
  /** Entry pay date, else the week's (0158). Null before that migration. */
  pay_date: string | null;
  cheque_no: string | null;
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
    phone_allowance: Number(r.phone_allowance ?? 0),
    pay_date: r.pay_date ?? null,
    cheque_no: r.cheque_no ?? null,
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
  page: "payroll_employees",
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<Employee> => {
    const supabase = await createClient();
    const { data, error } = await writeDroppingPending(
      (row) => supabase.from("employees").insert(row).select("*").single(),
      {
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
      },
      EMPLOYEE_PENDING,
    );
    if (error) throw error;
    revalidatePath("/payroll");
    return data as Employee;
  },
});

export const updateEmployee = wrapAction({
  schema: UpdateEmployeeInput,
  page: "payroll_employees",
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<Employee> => {
    const supabase = await createClient();
    const { id, code, ...rest } = input;
    const codeUpdate = code?.trim() ? { code: code.trim() } : {};
    const { data, error } = await writeDroppingPending(
      (patch) => supabase.from("employees").update(patch).eq("id", id).select("*").single(),
      { ...rest, ...codeUpdate, sin_last4: rest.sin_last4 || null, profile_id: rest.profile_id || null, notes: rest.notes || null, updated_by: profile.id },
      EMPLOYEE_PENDING,
    );
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

export async function listPayrollWeeks(
  locationIds?: string[] | null,
): Promise<PayrollWeekWithLocation[]> {
  const supabase = await createClient();
  // Every week of the rolling 12 months the page totals — a flat 52 rows
  // was only about 3 months with four shops on weekly pay — then older weeks
  // so the list still holds at least 52.
  const since = rollingYearStart(todayISO());
  // payroll_entries(*), not a column list: phone_allowance only exists once
  // 0158 is applied, and naming a missing column fails the whole read.
  const select = `*,
    locations(name, code),
    payroll_entries(*),
    payroll_payments(amount)`;
  const recent = await fetchAllRows<unknown>((from, to) => {
    let q = supabase.from("payroll_weeks").select(select).gte("week_start", since);
    q = applyLocationFilter(q, "location_id", locationIds ?? null);
    return q.order("week_start", { ascending: false }).order("id").range(from, to);
  });
  let older: unknown[] = [];
  if (recent.length < 52) {
    let q = supabase.from("payroll_weeks").select(select).lt("week_start", since);
    q = applyLocationFilter(q, "location_id", locationIds ?? null);
    const res = await q.order("week_start", { ascending: false }).order("id").limit(52 - recent.length);
    if (res.error) throw res.error;
    older = res.data ?? [];
  }
  const data = [...recent, ...older];
  type EntryShape = {
    gross_wages: number;
    overtime_wages: number;
    bonus: number;
    misc_extra: number;
    holiday_pay: number;
    phone_allowance?: number;
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
    const totalGross = entries.reduce((s, e) => s + payrollGross(e), 0);
    const totalDeductions = entries.reduce((s, e) => s + payrollDeductions(e), 0);
    const totalEmployerCost =
      sum("ei_employer")
      + sum("cpp_employer")
      + sum("cpp_employer2")
      + sum("wsib_employer")
      + sum("benefit_employer_contribution")
      + sum("vacation_pay");
    // The joined rows were only needed for the roll-ups; don't carry every
    // entry column along with each week.
    const week = omitKeys(row, ["locations", "payroll_entries", "payroll_payments"]);
    return {
      ...(week as unknown as PayrollWeek),
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
  /** HST/GST registration — the business number on the pay stub. */
  location_hst_number: string | null;
  /** The week's default pay date (0158); null before that migration. */
  pay_date: string | null;
  entries: PayrollEntryWithEmployee[];
  payments: PayrollPayment[];
}

export interface PayrollEntryWithEmployee extends PayrollEntry {
  employee_name: string;
  employee_code: string | null;
  employee_payroll_type: string;
  cash_days: PayrollCashDaily[];
  // Read as 0 / null when 0158 hasn't added the columns yet.
  phone_allowance: number;
  vacation_rate: number | null;
}

export async function getPayrollWeek(weekId: string): Promise<PayrollWeekDetail | null> {
  const supabase = await createClient();

  const { data: week, error: weekErr } = await supabase
    .from("payroll_weeks")
    .select("*, locations(name, code, address, phone, invoice_name, hst_number)")
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
      hst_number: string | null;
    };
  }).locations;

  return {
    ...(week as unknown as PayrollWeek),
    location_name: loc?.name ?? "",
    location_code: loc?.code ?? "",
    location_address: loc?.address ?? null,
    location_phone: loc?.phone ?? null,
    location_invoice_name: loc?.invoice_name ?? null,
    location_hst_number: loc?.hst_number ?? null,
    pay_date: (week as { pay_date?: string | null }).pay_date ?? null,
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
        phone_allowance: Number(row.phone_allowance ?? 0),
        vacation_rate: row.vacation_rate == null ? null : Number(row.vacation_rate),
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
  page: "payroll",
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<PayrollWeek> => {
    const supabase = await createClient();
    const weekStart = snapToSunday(input.week_start);
    const { data, error } = await writeDroppingPending(
      (row) => supabase.from("payroll_weeks").insert(row).select("*").single(),
      {
        location_id: input.location_id,
        week_start: weekStart,
        period_weeks: input.period_weeks,
        pay_date: input.pay_date || null,
        notes: input.notes || null,
        created_by: profile.id,
        updated_by: profile.id,
      },
      WEEK_PENDING,
    );
    if (error) throw error;
    revalidatePath("/payroll");
    return data as PayrollWeek;
  },
});

export const updatePayrollWeekStatus = wrapAction({
  schema: UpdatePayrollWeekStatusInput,
  page: "payroll",
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
  page: "payroll",
  roles: [...PAYROLL_ROLES],
  handler: async (input, profile): Promise<PayrollWeek> => {
    const supabase = await createClient();
    const { data, error } = await writeDroppingPending(
      (patch) => supabase.from("payroll_weeks").update(patch).eq("id", input.id).select("*").single(),
      {
        location_id: input.location_id,
        week_start: snapToSunday(input.week_start),
        period_weeks: input.period_weeks,
        // Only when the form sent it, so an older tab can't blank it out.
        ...(input.pay_date !== undefined ? { pay_date: input.pay_date || null } : {}),
        notes: input.notes || null,
        updated_by: profile.id,
      },
      WEEK_PENDING,
    );
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
  page: "payroll",
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
 * One source of truth for create + update so we never drift on overtime,
 * vacation, employer EI/CPP, or WSIB.
 */
async function buildEntryPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: PayrollEntryInput,
) {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // A form opened before 0158 shipped sends no phone allowance or vacation
  // rate; the entry it replaces is read so those keep what they had.
  const keepStored = input.phone_allowance === undefined || input.vacation_rate === undefined;

  // The year, the shop's vacation/WSIB rates, the employee's vacation override.
  // employees/payroll_entries are read with "*": the 0158 columns are named
  // nowhere, so these reads work before that migration too.
  const [{ data: weekRow }, { data: settings }, { data: employee }, stored] = await Promise.all([
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
    supabase.from("employees").select("*").eq("id", input.employee_id).maybeSingle(),
    keepStored
      ? supabase
          .from("payroll_entries")
          .select("*")
          .eq("payroll_week_id", input.payroll_week_id)
          .eq("employee_id", input.employee_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const year = weekRow ? Number(String(weekRow.week_start).slice(0, 4)) : new Date().getFullYear();
  const wsibRate = Number(settings?.wsib_rate ?? 0);
  const existing = stored.data as PayrollEntry | null;
  const emp = employee as Employee | null;

  // Vacation rate (client 2026-10-20): the entry's own → the employee's
  // override → the shop rate. An older form keeps the rate the entry was
  // saved at (worked back from its vacation pay if it predates 0158).
  const keptRate =
    input.vacation_rate === undefined && existing
      ? existing.vacation_rate ?? inferVacationRate(existing)
      : null;
  const vacationRate = resolveVacationRate(
    input.vacation_rate,
    keptRate,
    emp?.vacation_pay_rate,
    settings?.vacation_pay_rate ?? 0.04,
  );
  const phoneAllowance = input.phone_allowance ?? Number(existing?.phone_allowance ?? 0);

  // Regular / OT / holiday wages, vacation accrual (wages + OT + bonus +
  // holiday — not phone allowance or misc), and insurable earnings (everything
  // but misc_extra, which is taxable but NOT insurable).
  const pay = computeEntryEarnings({ ...input, phone_allowance: phoneAllowance }, vacationRate);
  const insurable = pay.insurable;

  // EI / CPP / CPP2 are typed on the entry (client 2026-09-15). Only an amount
  // the save left out is calculated from the rate table — see PayrollEntryInput
  // — so the rates are read only when something is actually missing.
  const typed = {
    ei: input.ei_employee,
    cpp: input.cpp_employee,
    cpp2: input.cpp_employee2,
    ei_employer: input.ei_employer,
    cpp_employer: input.cpp_employer,
    cpp_employer2: input.cpp_employer2,
  };
  const computed = Object.values(typed).some((v) => v === undefined)
    ? _computeStatutoryDeductions(insurable, await getStatutoryRatesForYear(year), year)
    : null;
  const amount = (key: keyof typeof typed) => round2(typed[key] ?? computed?.[key] ?? 0);

  // Optional statutory items (0135). A flag that is off zeroes the employee
  // amount AND the employer side that mirrors it — an EI-exempt employee costs
  // the shop no employer EI. CPP off takes CPP2 with it: someone exempt from
  // tier 1 (under 18, over 70, CPT30) is exempt from tier 2 by definition.
  const applyCpp2 = input.apply_cpp && input.apply_cpp2;

  const ei = input.apply_ei ? amount("ei") : 0;
  const ei_employer = input.apply_ei ? amount("ei_employer") : 0;
  const cpp = input.apply_cpp ? amount("cpp") : 0;
  const cpp_employer = input.apply_cpp ? amount("cpp_employer") : 0;
  const cpp2 = applyCpp2 ? amount("cpp2") : 0;
  const cpp_employer2 = applyCpp2 ? amount("cpp_employer2") : 0;
  const incomeTax = input.apply_income_tax ? input.income_tax : 0;

  const wsibEmployer = input.apply_wsib ? round2(insurable * wsibRate) : 0;

  const netPay = computeNetPay(pay.gross, {
    ei,
    cpp,
    cpp2,
    incomeTax,
    benefit: input.benefit_employee_deduction,
  });
  // Deductions are typed now, so a slipped digit could take more than the
  // period paid. Nothing legitimate on this form produces a negative cheque.
  if (netPay < 0) {
    throw new Error(
      `Deductions ($${round2(ei + cpp + cpp2 + incomeTax + input.benefit_employee_deduction).toFixed(2)}) are more than this period's pay — check the EI, CPP, tax and benefit amounts.`,
    );
  }

  return {
    payroll_week_id: input.payroll_week_id,
    employee_id: input.employee_id,
    hours: input.hours,
    rate: input.rate,
    gross_wages: pay.regularWages,
    overtime_hours: input.overtime_hours,
    overtime_rate: input.overtime_rate,
    overtime_wages: pay.overtimeWages,
    holiday_hours: input.holiday_hours,
    holiday_rate: pay.holidayRate,
    holiday_pay: pay.holidayPay,
    vacation_pay: pay.vacationPay,
    vacation_rate: vacationRate,
    bonus: input.bonus,
    misc_extra: input.misc_extra,
    phone_allowance: phoneAllowance,
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
    // Only when the form sent them, so an older tab can't blank them out.
    ...(input.cheque_no !== undefined ? { cheque_no: input.cheque_no || null } : {}),
    ...(input.pay_date !== undefined ? { pay_date: input.pay_date || null } : {}),
    net_pay: netPay,
    notes: input.notes || null,
  };
}

/**
 * "Add entry". An insert, not an upsert: picking someone already on the week
 * used to replace their saved entry — typed EI/CPP/tax, cheque no. and pay
 * date — with the fresh form. Editing goes through updatePayrollEntry.
 */
export const createPayrollEntry = wrapAction({
  schema: PayrollEntryInput,
  page: "payroll",
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<PayrollEntry> => {
    const supabase = await createClient();
    const payload = await buildEntryPayload(supabase, input);

    const { data, error } = await writeDroppingPending(
      (row) => supabase.from("payroll_entries").insert(row).select("*").single(),
      { ...payload, created_by: profile.id, updated_by: profile.id },
      ENTRY_PENDING,
    );
    if (error) {
      if (error.code === "23505") {
        throw new Error("This employee is already on this pay week. Edit their entry instead.");
      }
      throw error;
    }
    revalidatePath(`/payroll/${input.payroll_week_id}`);
    return data as PayrollEntry;
  },
});

export const updatePayrollEntry = wrapAction({
  schema: UpdatePayrollEntryInput,
  page: "payroll",
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<PayrollEntry> => {
    const supabase = await createClient();
    const { id, ...rest } = input;
    const payload = await buildEntryPayload(supabase, rest);

    const { data, error } = await writeDroppingPending(
      (patch) => supabase.from("payroll_entries").update(patch).eq("id", id).select("*").single(),
      { ...payload, updated_by: profile.id },
      ENTRY_PENDING,
    );
    if (error) throw error;
    revalidatePath(`/payroll/${rest.payroll_week_id}`);
    return data as PayrollEntry;
  },
});

export const deletePayrollEntry = wrapAction({
  schema: PayrollIdInput,
  page: "payroll",
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
  page: "payroll",
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
  page: "payroll",
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
  page: "payroll",
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
  page: "payroll",
  roles: [...PAYROLL_ROLES],
  handler: async (input, profile): Promise<PayrollPayment> => {
    const supabase = await createClient();
    const { id, transaction_id, ...rest } = input;
    const reference = transaction_id?.trim();
    const { data, error } = await writeDroppingPending(
      (patch) => supabase.from("payroll_payments").update(patch).eq("id", id).select("*").single(),
      {
        ...rest,
        notes: rest.notes || null,
        // A blank reference keeps the one the payment has (its TXN- number,
        // or what was typed) — editing the amount must not wipe it.
        ...(reference ? { transaction_id: reference } : {}),
        updated_by: profile.id,
      },
      PAYMENT_PENDING,
    );
    if (error) throw error;
    revalidatePath(`/payroll/${rest.payroll_week_id}`);
    revalidatePath("/payroll");
    return data as PayrollPayment;
  },
});

export const deletePayrollPayment = wrapAction({
  schema: PayrollIdInput,
  page: "payroll",
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
