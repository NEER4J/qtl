import { z } from "zod";

import { moneySchema, paymentModeSchema, paymentStatusSchema } from "@/lib/schemas/common";

// Accept either ISO datetime string or "HH:mm" converted on the client.
const datetimeNullable = z
  .union([z.string().datetime(), z.string().length(0), z.null()])
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : (v ?? null)));

export const SalesJobInput = z
  .object({
    id: z.string().uuid().optional(),
    location_id: z.string().uuid("Select a location"),
    job_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),

    bay_no: z.coerce.number().int().min(1).max(20).nullable().optional(),
    upper_deck: z.string().trim().max(60).nullable().optional().or(z.literal("")),
    lower_deck: z.string().trim().max(60).nullable().optional().or(z.literal("")),

    invoice_no: z.string().trim().min(1, "Invoice number is required").max(40),

    customer_id: z.string().uuid().nullable().optional(),
    billing_name: z.string().trim().min(1, "Billing name is required").max(200),
    license_plate: z.string().trim().toUpperCase().max(15).nullable().optional().or(z.literal("")),
    contact_no: z.string().trim().max(30).nullable().optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Invalid email")
      .max(120)
      .nullable()
      .optional()
      .or(z.literal("")),
    odometer: z.coerce.number().int().min(0).max(9999999).nullable().optional(),

    service_type_id: z.string().uuid("Select a service type"),
    carrier_name: z.string().trim().max(120).nullable().optional().or(z.literal("")),

    start_time: datetimeNullable,
    end_time: datetimeNullable,

    comments: z.string().trim().max(2000).nullable().optional().or(z.literal("")),

    sub_total: moneySchema,
    hst: moneySchema,
    total: moneySchema,
    paid_amount: moneySchema.default(0),
    payment_mode: paymentModeSchema.nullable().optional(),
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
    if (val.start_time && val.end_time && new Date(val.end_time) < new Date(val.start_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "End time cannot be before start time",
      });
    }
  });
export type SalesJobInput = z.infer<typeof SalesJobInput>;

export const UpdateSalesJobInput = SalesJobInput.and(
  z.object({ id: z.string().uuid() }),
);
export type UpdateSalesJobInput = z.infer<typeof UpdateSalesJobInput>;

// ----------------------------------------------------------------------------
// Partial payments
// ----------------------------------------------------------------------------
export const AddSalesPaymentInput = z.object({
  sales_job_id: z.string().uuid(),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  amount: moneySchema.refine((v) => v > 0, "Amount must be greater than zero"),
  mode: paymentModeSchema,
  transaction_id: z.string().trim().max(100).nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});

// ----------------------------------------------------------------------------
// List filters
// ----------------------------------------------------------------------------
export const ListSalesJobsInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location_id: z.string().uuid().optional(),
  service_type_id: z.string().uuid().optional(),
  payment_status: paymentStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type ListSalesJobsInput = z.infer<typeof ListSalesJobsInput>;

// ----------------------------------------------------------------------------
// Deactivate (owner-only — enforced by RLS + trigger)
// ----------------------------------------------------------------------------
export const DeactivateSalesJobInput = z.object({
  id: z.string().uuid(),
});
