import { z } from "zod";

const moneySchema = z.coerce.number().min(0).max(999999.99);

export const VendorInvoiceItemInput = z.object({
  vendor_part_id: z.string().uuid().nullable().optional(),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v)),
  quantity: z.coerce.number().min(0.001),
  unit_cost: moneySchema,
});
export type VendorInvoiceItemInput = z.infer<typeof VendorInvoiceItemInput>;

export const CreateVendorInvoiceInput = z.object({
  vendor_id: z.string().uuid(),
  location_id: z.string().uuid(),
  invoice_no: z
    .string()
    .trim()
    .max(60)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v)),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  sub_total: moneySchema,
  hst: moneySchema,
  paid_amount: moneySchema.default(0),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v)),
  items: z.array(VendorInvoiceItemInput).default([]),
});
export type CreateVendorInvoiceInput = z.infer<typeof CreateVendorInvoiceInput>;

export const RecordVendorInvoicePaymentInput = z.object({
  id: z.string().uuid(),
  amount: moneySchema.refine((v) => v > 0, "Amount must be > 0"),
});
