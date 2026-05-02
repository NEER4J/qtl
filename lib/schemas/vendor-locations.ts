import { z } from "zod";

const textOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v));

export const UpsertVendorLocationInput = z.object({
  vendor_id: z.string().uuid(),
  location_id: z.string().uuid(),
  account_no: textOptional(60),
  account_type: textOptional(60),
  contact_no: textOptional(30),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(120)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v)),
  sales_rep_name: textOptional(120),
  notes: textOptional(2000),
});
export type UpsertVendorLocationInput = z.infer<typeof UpsertVendorLocationInput>;

export const DeleteVendorLocationInput = z.object({
  vendor_id: z.string().uuid(),
  location_id: z.string().uuid(),
});
