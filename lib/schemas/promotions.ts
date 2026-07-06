import { z } from "zod";

export const CreatePromotionInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  discount_type: z.enum(["percent", "fixed"]),
  // Percent (e.g. 10 = 10%) or a fixed dollar amount. Must be > 0.
  discount_value: z.coerce.number().positive("Must be greater than 0"),
  // A promo is non-taxable by default (discount applies after tax).
  is_taxable: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.coerce.boolean().default(true),
});
export type CreatePromotionInput = z.infer<typeof CreatePromotionInput>;

export const UpdatePromotionInput = CreatePromotionInput.extend({
  id: z.string().uuid(),
});
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionInput>;

export const TogglePromotionActiveInput = z.object({
  id: z.string().uuid(),
  active: z.coerce.boolean(),
});
