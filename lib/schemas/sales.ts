import { z } from "zod";

import { moneySchema, paymentModeSchema, paymentStatusSchema } from "@/lib/schemas/common";

// Accept either HTML datetime-local ("yyyy-mm-ddThh:mm" with optional seconds)
// or full ISO 8601 with timezone. Empty strings become null.
const datetimeLocalRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

const datetimeNullable = z
  .union([
    z.string().regex(datetimeLocalRegex, "Invalid datetime"),
    z.string().length(0),
    z.null(),
  ])
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : (v ?? null)));

export const SalesJobItemInput = z.object({
  id: z.string().uuid().optional(),
  part_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "Description required").max(300),
  quantity: z.coerce.number().positive("Qty must be > 0").max(99999),
  unit_price: z.coerce.number().min(0, "Price must be ≥ 0").max(9999999),
  is_taxable: z.coerce.boolean().default(true),
  package_label: z.string().trim().max(120).nullable().optional(),
});
export type SalesJobItemInput = z.infer<typeof SalesJobItemInput>;

export const SalesJobInput = z
  .object({
    id: z.string().uuid().optional(),
    location_id: z.string().uuid("Select a location"),
    job_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),

    bay_no: z.coerce.number().int().min(1).max(20).nullable().optional(),
    upper_tech: z.string().trim().max(60).nullable().optional().or(z.literal("")),
    lower_tech: z.string().trim().max(60).nullable().optional().or(z.literal("")),

    invoice_no: z.string().trim().max(40).nullable().optional().or(z.literal("")),

    customer_id: z.string().uuid().nullable().optional(),
    billing_name: z.string().trim().min(1, "Billing name is required").max(200),
    billing_address: z.string().trim().max(500).nullable().optional().or(z.literal("")),
    business_phone: z.string().trim().max(30).nullable().optional().or(z.literal("")),
    alt_phone: z.string().trim().max(30).nullable().optional().or(z.literal("")),
    customer_order_no: z.string().trim().max(60).nullable().optional().or(z.literal("")),
    unit_no: z.string().trim().max(40).nullable().optional().or(z.literal("")),
    vehicle_year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
    vehicle_make: z.string().trim().max(60).nullable().optional().or(z.literal("")),
    vehicle_model: z.string().trim().max(60).nullable().optional().or(z.literal("")),
    vin: z.string().trim().toUpperCase().max(40).nullable().optional().or(z.literal("")),
    engine_size: z.string().trim().max(40).nullable().optional().or(z.literal("")),
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

    engine_type_id: z.string().uuid().nullable().optional(),
    oil_type_id: z.string().uuid().nullable().optional(),
    oil_container: z.enum(["bulk", "gallon"]).nullable().optional(),
    auto_priced_at: z.string().nullable().optional(),
    items: z.array(SalesJobItemInput).optional(),
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
