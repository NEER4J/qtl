import { z } from "zod";

export const CreateVendorInput = z.object({
  code: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required").max(200),
  contact_no: z.string().trim().max(30).optional().nullable().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(120)
    .optional()
    .nullable()
    .or(z.literal("")),
  account_no: z.string().trim().max(60).optional().nullable().or(z.literal("")),
  account_type: z.string().trim().max(60).optional().nullable().or(z.literal("")),
  category_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  notes: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
});
export type CreateVendorInput = z.infer<typeof CreateVendorInput>;

export const UpdateVendorInput = CreateVendorInput.extend({
  id: z.string().uuid(),
});

export const SearchVendorsInput = z.object({
  q: z.string().trim().max(100).default(""),
  category_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
