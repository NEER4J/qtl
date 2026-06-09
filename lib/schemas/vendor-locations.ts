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

// One account row in the per-location accounts list.
export const VendorLocationAccountInput = z.object({
  label: textOptional(60),
  account_no: textOptional(60),
  account_type: textOptional(60),
  is_default: z.coerce.boolean().default(false),
});
export type VendorLocationAccountInput = z.infer<typeof VendorLocationAccountInput>;

// Replace-all for a (vendor, location)'s accounts. Empty rows are dropped.
export const ReplaceVendorLocationAccountsInput = z.object({
  vendor_id: z.string().uuid(),
  location_id: z.string().uuid(),
  accounts: z.array(VendorLocationAccountInput).max(20).default([]),
});
export type ReplaceVendorLocationAccountsInput = z.infer<
  typeof ReplaceVendorLocationAccountsInput
>;
