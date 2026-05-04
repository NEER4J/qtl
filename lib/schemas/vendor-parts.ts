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

export const CreateVendorPartInput = z.object({
  vendor_id: z.string().uuid(),
  part_id: z.string().uuid(),
  vendor_part_number: textOptional(80),
  cost: z.coerce.number().min(0, "Must be ≥ 0"),
  is_preferred: z.coerce.boolean().default(false),
  notes: textOptional(500),
});
export type CreateVendorPartInput = z.infer<typeof CreateVendorPartInput>;

export const UpdateVendorPartInput = CreateVendorPartInput.extend({
  id: z.string().uuid(),
});
export type UpdateVendorPartInput = z.infer<typeof UpdateVendorPartInput>;

export const DeactivateVendorPartInput = z.object({ id: z.string().uuid() });
