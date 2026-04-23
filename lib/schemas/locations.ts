import { z } from "zod";

export const CreateLocationInput = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(10, "Code must be 10 characters or fewer")
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, digits, or underscores"),
  name: z.string().trim().min(1, "Name is required").max(120),
  address: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(120)
    .optional()
    .nullable()
    .or(z.literal("")),
  active: z.coerce.boolean().default(true),
});
export type CreateLocationInput = z.infer<typeof CreateLocationInput>;

export const UpdateLocationInput = CreateLocationInput.extend({
  id: z.string().uuid(),
});
export type UpdateLocationInput = z.infer<typeof UpdateLocationInput>;

export const ToggleLocationActive = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});
