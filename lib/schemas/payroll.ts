import { z } from "zod";
import { moneySchema, paymentModeSchema } from "@/lib/schemas/common";


// ----------------------------------------------------------------------------
// Optional statutory items (0135). Every one defaults to ON — an employee with
// no flags touched is deducted exactly as before.
// ----------------------------------------------------------------------------

export const DeductionFlags = z.object({
  /** Deduct employee EI (and charge employer EI). Off for non-arm's-length staff. */
  apply_ei: z.boolean().default(true),
  /** Deduct CPP tier 1. Off also forces CPP2 off — CPP-exempt is CPP2-exempt. */
  apply_cpp: z.boolean().default(true),
  /** Deduct CPP tier 2 (earnings above YMPE). */
  apply_cpp2: z.boolean().default(true),
  /** Withhold income tax. Off stores 0 whatever was typed in the tax field. */
  apply_income_tax: z.boolean().default(true),
  /** Accrue vacation pay at the shop rate. Off when vacation is paid out each cheque. */
  apply_vacation: z.boolean().default(true),
  /** Charge the employer WSIB premium. */
  apply_wsib: z.boolean().default(true),
});
export type DeductionFlags = z.infer<typeof DeductionFlags>;

// ----------------------------------------------------------------------------
// Employees
// ----------------------------------------------------------------------------

export const EmployeeInput = z.object({
  code: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  full_name: z.string().trim().min(1, "Name is required").max(120),
  sin_last4: z.string().trim().length(4).regex(/^\d{4}$/, "Must be 4 digits").nullable().optional().or(z.literal("")),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
  termination_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
  payroll_type: z.enum(["employee", "management"]).default("employee"),
  default_hourly_rate: moneySchema.default(0),
  location_id: z.string().uuid("Select a location").nullable().optional(),
  // Optional link to a login user (profiles.id). When set, that user can see
  // this employee's pay on the staff-facing "My Pay" page.
  profile_id: z.string().uuid().nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
}).merge(DeductionFlags);
export type EmployeeInput = z.infer<typeof EmployeeInput>;

export const UpdateEmployeeInput = EmployeeInput.and(z.object({ id: z.string().uuid() }));
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeInput>;

// ----------------------------------------------------------------------------
// Payroll weeks
// ----------------------------------------------------------------------------

/** True if the given YYYY-MM-DD string is a Sunday in UTC. */
function isSundayYmd(ymd: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return false;
  const [, y, mo, d] = m;
  // Use UTC so the validation matches Postgres `extract(dow from week_start)`
  // — both interpret the date with no timezone offset.
  const dow = new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay();
  return dow === 0; // Sunday = 0
}

export const PayrollWeekInput = z.object({
  location_id: z.string().uuid("Select a location"),
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required")
    .refine(isSundayYmd, "Pay week must start on a Sunday"),
  // 1 = weekly (Sun–Sat), 2 = bi-weekly (two paycheques a month).
  period_weeks: z.coerce.number().int().min(1).max(2).default(1),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});
export type PayrollWeekInput = z.infer<typeof PayrollWeekInput>;

export const UpdatePayrollWeekStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "approved", "paid"]),
});

/** Edit an existing week — same fields as creation, plus the id. Location is
 *  editable because a week booked against the wrong shop was previously
 *  unfixable. */
export const UpdatePayrollWeekInput = PayrollWeekInput.and(
  z.object({ id: z.string().uuid() }),
);
export type UpdatePayrollWeekInput = z.infer<typeof UpdatePayrollWeekInput>;

// ----------------------------------------------------------------------------
// Payroll entries
// ----------------------------------------------------------------------------

export const PayrollEntryInput = z.object({
  payroll_week_id: z.string().uuid(),
  employee_id: z.string().uuid("Select an employee"),
  hours: z.coerce.number().min(0).max(168).default(0),
  rate: z.coerce.number().min(0).default(0),
  overtime_hours: z.coerce.number().min(0).max(168).default(0),
  overtime_rate: z.coerce.number().min(0).default(0),
  // Holiday pay is entered as hours × rate (0136); the dollar amount is
  // derived server-side, so there is no holiday_pay input any more.
  holiday_hours: z.coerce.number().min(0).max(168).default(0),
  holiday_rate: z.coerce.number().min(0).default(0),
  bonus: moneySchema.default(0),
  misc_extra: moneySchema.default(0),
  income_tax: moneySchema.default(0),
  benefit_employee_deduction: moneySchema.default(0),
  benefit_employer_contribution: moneySchema.default(0),
  cheque_amount: moneySchema.default(0),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
}).merge(DeductionFlags);
export type PayrollEntryInput = z.infer<typeof PayrollEntryInput>;

export const UpdatePayrollEntryInput = PayrollEntryInput.and(z.object({ id: z.string().uuid() }));
export type UpdatePayrollEntryInput = z.infer<typeof UpdatePayrollEntryInput>;

// ----------------------------------------------------------------------------
// Cash daily
// ----------------------------------------------------------------------------

export const PayrollCashDailyInput = z.object({
  payroll_entry_id: z.string().uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  amount: moneySchema.default(0),
  notes: z.string().trim().max(200).nullable().optional().or(z.literal("")),
});
export type PayrollCashDailyInput = z.infer<typeof PayrollCashDailyInput>;

// ----------------------------------------------------------------------------
// Payroll payments
// ----------------------------------------------------------------------------

export const PayrollPaymentInput = z.object({
  payroll_week_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  amount: moneySchema.refine((v) => v > 0, "Amount must be greater than zero"),
  mode: paymentModeSchema,
  transaction_id: z.string().trim().max(100).nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});
export type PayrollPaymentInput = z.infer<typeof PayrollPaymentInput>;

export const UpdatePayrollPaymentInput = PayrollPaymentInput.and(
  z.object({ id: z.string().uuid() }),
);
export type UpdatePayrollPaymentInput = z.infer<typeof UpdatePayrollPaymentInput>;

// ----------------------------------------------------------------------------
// Deletes — every payroll row can now be removed, not just corrected.
// ----------------------------------------------------------------------------

export const PayrollIdInput = z.object({ id: z.string().uuid() });
export type PayrollIdInput = z.infer<typeof PayrollIdInput>;
