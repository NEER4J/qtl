import { z } from "zod";

import { moneySchema, paymentModeSchema, paymentStatusSchema, signedMoneySchema } from "@/lib/schemas/common";

export const SalesJobItemInput = z.object({
  id: z.string().uuid().optional(),
  part_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "Description required").max(300),
  quantity: z.coerce.number().positive("Qty must be > 0").max(99999),
  // Negative allowed so a discount / credit line can be entered.
  unit_price: z.coerce.number().min(-9999999).max(9999999),
  // Per-unit Sell MHSW snapshot (already inside unit_price); shown as its own
  // column on the job / invoice. 0 for non-part lines.
  mhsw_unit: z.coerce.number().min(0).max(9999999).default(0),
  is_taxable: z.coerce.boolean().default(true),
  package_label: z.string().trim().max(120).nullable().optional(),
  // Per-instance group id so all lines from one package collapse to a single
  // display line. Null for standalone items.
  package_group: z.string().uuid().nullable().optional(),
  // Source refs for overlap detection (oil item / Trans & Diff service item).
  oil_type_id: z.string().uuid().nullable().optional(),
  transmission_service_id: z.string().uuid().nullable().optional(),
  // Waived unit price when this line is a merged duplicate (billed at $0).
  merged_unit_price: z.coerce.number().min(0).nullable().optional(),
  // True when the customer brought the part themselves; line_total forced to 0.
  is_customer_supplied: z.coerce.boolean().default(false),
})
  .refine((it) => !(it.part_id && it.oil_type_id), {
    message: "A line can't be both a catalog part and an oil item",
    path: ["part_id"],
  });
export type SalesJobItemInput = z.infer<typeof SalesJobItemInput>;

// HH:mm or HH:mm:ss; empty becomes null.
const timeNullable = z
  .union([
    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time"),
    z.string().length(0),
    z.null(),
  ])
  .nullable()
  .optional()
  .transform((v) => (v === "" || v == null ? null : (v.length === 5 ? `${v}:00` : v)));

export const SalesJobInput = z
  .object({
    id: z.string().uuid().optional(),
    location_id: z.string().uuid("Select a location"),
    job_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
    start_time: timeNullable,
    end_time: timeNullable,

    bay_no: z.coerce.number().int().min(1).max(20).nullable().optional(),
    upper_tech: z.string().trim().max(60).nullable().optional().or(z.literal("")),
    lower_tech: z.string().trim().max(60).nullable().optional().or(z.literal("")),

    invoice_no: z.string().trim().max(40).nullable().optional().or(z.literal("")),

    customer_id: z.string().uuid().nullable().optional(),
    vehicle_id: z.string().uuid().nullable().optional(),               // item #4 link
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
    advisor_name: z.string().trim().max(120).nullable().optional().or(z.literal("")),  // item #7

    comments: z.string().trim().max(2000).nullable().optional().or(z.literal("")),

    sub_total: signedMoneySchema,
    hst: signedMoneySchema,
    total: signedMoneySchema,
    paid_amount: moneySchema.default(0),
    /** Store credit from the customer account applied to reduce amount due. */
    credit_applied: moneySchema.default(0),
    /** Optional link to the original invoice when this job includes a return. */
    credited_from_job_id: z.string().uuid().nullable().optional(),
    payment_mode: paymentModeSchema.nullable().optional(),
    /**
     * Multiple-payment shape used at job creation. When provided and non-empty,
     * the action layer ignores `paid_amount` + `payment_mode` and inserts one
     * `sales_payments` row per entry. `paid_amount` on the job ends up as the
     * sum; `payment_mode` is the first row's mode (kept for legacy reporting).
     * On update, this is ignored — payment edits go through addSalesPayment.
     */
    initial_payments: z
      .array(
        z.object({
          mode: paymentModeSchema,
          amount: moneySchema.refine((v) => v > 0, "Amount must be > 0"),
        }),
      )
      .optional(),

    // Dump-truck surcharge — the $ snapshot actually baked into sub_total.
    is_dump_truck: z.coerce.boolean().default(false),
    dump_truck_surcharge: z.coerce.number().min(0).default(0),

    // Free grease (item #15)
    free_grease_applied: z.coerce.boolean().default(false),
    free_grease_override_reason: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal("")),

    engine_type_id: z.string().uuid().nullable().optional(),
    oil_type_id: z.string().uuid().nullable().optional(),
    oil_container: z.enum(["bulk", "gallon"]).nullable().optional(),
    auto_priced_at: z.string().nullable().optional(),
    items: z.array(SalesJobItemInput).optional(),
    // Role-gated escape hatch when a stock-shortfall block needs to be
    // consciously bypassed (server re-checks the role; a non-privileged
    // caller sending this is simply ignored, not trusted).
    override_stock_check: z.coerce.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (Math.abs(val.total - (val.sub_total + val.hst)) > 0.02) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "Total must equal Sub Total + HST",
      });
    }
    // initial_payments takes precedence when present — validate its sum
    // against amount due (total minus store credit). Negative-total jobs
    // cannot take cash payments.
    const payments = val.initial_payments ?? [];
    const amountDue = val.total - val.credit_applied;
    if (val.total < -0.005) {
      if (payments.length > 0 || val.paid_amount > 0.005) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paid_amount"],
          message: "Credit invoices cannot record cash payments",
        });
      }
      if (val.credit_applied > 0.005) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["credit_applied"],
          message: "Store credit cannot be applied when the invoice total is negative",
        });
      }
    } else {
      // Paying MORE than the amount due is allowed — the excess becomes store
      // credit on the customer's account — but that needs a customer account
      // to hold it, so anonymous/new-name jobs still get the hard cap.
      const sum =
        payments.length > 0
          ? payments.reduce((a, p) => a + p.amount, 0)
          : val.paid_amount;
      if (sum > amountDue + 0.01 && !val.customer_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [payments.length > 0 ? "initial_payments" : "paid_amount"],
          message:
            "Payment is more than the amount due — pick an existing customer so the extra can be saved as store credit",
        });
      }
    }
    if (val.credit_applied > val.total + 0.01 && val.total > 0.005) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credit_applied"],
        message: "Store credit applied cannot exceed the invoice total",
      });
    }
    if (val.total < -0.005 && !val.customer_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customer_id"],
        message: "Select a customer — store credit cannot be issued without one",
      });
    }
    // HH:mm:ss strings sort lexicographically, so a plain string compare works.
    if (val.start_time && val.end_time && val.end_time < val.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "End time must be at or after start time",
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
