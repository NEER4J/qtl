import { z } from "zod";

import {
  moneySchema,
  paymentModeSchema,
  paymentStatusSchema,
  signedMoneySchema,
} from "@/lib/schemas/common";

// Item #24 — line items per expense (what parts the vendor billed for).
// Mirrors the sales_job_items shape. Either part_id or free-text description
// drives the row; vendor_part_id is the optional link back to vendor_parts.
export const ExpenseItemInput = z.object({
  id: z.string().uuid().optional(),
  part_id: z.string().uuid().nullable().optional(),
  vendor_part_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "Description required").max(500),
  quantity: z.coerce.number().min(0.001),
  // Signed so a promotion / vendor-discount line can carry a negative unit_cost.
  unit_cost: signedMoneySchema,
  // Snapshot of the part's last buying price at pick time. Persisted so the
  // drift indicator survives reopening the expense for edit.
  last_buying_price_snapshot: z.number().nullable().optional(),
});
export type ExpenseItemInput = z.infer<typeof ExpenseItemInput>;

export const ExpenseInput = z
  .object({
    id: z.string().uuid().optional(),
    location_id: z.string().uuid("Select a location"),
    expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),

    category_id: z.string().uuid("Select a category"),
    subcategory_id: z.string().uuid().nullable().optional(),

    vendor_id: z.string().uuid().nullable().optional(),
    vendor_name_snapshot: z.string().trim().max(200).nullable().optional().or(z.literal("")),
    invoice_no: z.string().trim().max(40).nullable().optional().or(z.literal("")),

    account_type: z.string().trim().max(60).nullable().optional().or(z.literal("")),
    account_number: z.string().trim().max(60).nullable().optional().or(z.literal("")),
    contact_no: z.string().trim().max(30).nullable().optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Invalid email")
      .max(120)
      .nullable()
      .optional()
      .or(z.literal("")),

    sub_total: moneySchema,
    hst: moneySchema,
    total: moneySchema,
    paid_amount: moneySchema.default(0),

    payment_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
      .or(z.literal("")),
    payment_mode: paymentModeSchema.nullable().optional(),
    transaction_id: z.string().trim().max(100).nullable().optional().or(z.literal("")),

    notes: z.string().trim().max(2000).nullable().optional().or(z.literal("")),

    items: z.array(ExpenseItemInput).default([]),
  })
  .superRefine((val, ctx) => {
    if (Math.abs(val.total - (val.sub_total + val.hst)) > 0.02) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "Total must equal Sub Total + HST",
      });
    }
    if (val.paid_amount > val.total + 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paid_amount"],
        message: "Paid amount cannot exceed Total",
      });
    }
  });
export type ExpenseInput = z.infer<typeof ExpenseInput>;

export const UpdateExpenseInput = ExpenseInput.and(
  z.object({ id: z.string().uuid() }),
);
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInput>;

// ----------------------------------------------------------------------------
// Payments
// ----------------------------------------------------------------------------
export const AddExpensePaymentInput = z.object({
  expense_id: z.string().uuid(),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  amount: moneySchema.refine((v) => v > 0, "Amount must be greater than zero"),
  mode: paymentModeSchema,
  transaction_id: z.string().trim().max(100).nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});

// ----------------------------------------------------------------------------
// List filters
// ----------------------------------------------------------------------------
export const ListExpensesInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  subcategory_id: z.string().uuid().optional(),
  vendor_id: z.string().uuid().optional(),
  payment_status: paymentStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type ListExpensesInput = z.infer<typeof ListExpensesInput>;

export const DeactivateExpenseInput = z.object({
  id: z.string().uuid(),
});
