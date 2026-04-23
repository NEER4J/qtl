import { z } from "zod";

export const CreateCustomerInput = z.object({
  billing_name: z.string().trim().min(1, "Billing name is required").max(200),
  contact_no: z.string().trim().max(30).optional().nullable().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(120)
    .optional()
    .nullable()
    .or(z.literal("")),
  license_plates: z.array(z.string().trim().toUpperCase().max(15)).default([]),
  home_location_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  notes: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;

export const UpdateCustomerInput = CreateCustomerInput.extend({
  id: z.string().uuid(),
});

export const SearchCustomersInput = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
