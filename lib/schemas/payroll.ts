import { z } from "zod";
import { moneySchema, paymentModeSchema } from "@/lib/schemas/common";

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
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});
export type EmployeeInput = z.infer<typeof EmployeeInput>;

export const UpdateEmployeeInput = EmployeeInput.and(z.object({ id: z.string().uuid() }));
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeInput>;

// ----------------------------------------------------------------------------
// Payroll weeks
// ----------------------------------------------------------------------------

export const PayrollWeekInput = z.object({
  location_id: z.string().uuid("Select a location"),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});
export type PayrollWeekInput = z.infer<typeof PayrollWeekInput>;

export const UpdatePayrollWeekStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "approved", "paid"]),
});

// ----------------------------------------------------------------------------
// Payroll entries
// ----------------------------------------------------------------------------

export const PayrollEntryInput = z.object({
  payroll_week_id: z.string().uuid(),
  employee_id: z.string().uuid("Select an employee"),
  hours: z.coerce.number().min(0).max(168).default(0),
  rate: z.coerce.number().min(0).default(0),
  bonus: moneySchema.default(0),
  misc_extra: moneySchema.default(0),
  income_tax: moneySchema.default(0),
  benefit_employee_deduction: moneySchema.default(0),
  benefit_employer_contribution: moneySchema.default(0),
  cheque_amount: moneySchema.default(0),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});
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
