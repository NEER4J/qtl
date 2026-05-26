import { z } from "zod";

export const CreateTechnicianInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  role: z
    .string()
    .trim()
    .max(80)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v == null || v === "" ? null : v)),
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.coerce.boolean().default(true),
});
export type CreateTechnicianInput = z.infer<typeof CreateTechnicianInput>;

export const UpdateTechnicianInput = CreateTechnicianInput.extend({
  id: z.string().uuid(),
});
export type UpdateTechnicianInput = z.infer<typeof UpdateTechnicianInput>;

export const ToggleTechnicianActiveInput = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});
