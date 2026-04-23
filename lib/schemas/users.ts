import { z } from "zod";

import { userRoleSchema } from "@/lib/schemas/common";

// ----------------------------------------------------------------------------
// Shared refinements
// ----------------------------------------------------------------------------
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Invalid email");

const roleLocationRefine = (
  data: { role: z.infer<typeof userRoleSchema>; location_id: string | null },
  ctx: z.RefinementCtx,
) => {
  if ((data.role === "manager" || data.role === "staff" || data.role === "employee") && !data.location_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["location_id"],
      message: `${data.role[0].toUpperCase()}${data.role.slice(1)} must be assigned to a location`,
    });
  }
};

// ----------------------------------------------------------------------------
// Invite (admin creates + sends email)
// ----------------------------------------------------------------------------
export const InviteUserInput = z
  .object({
    email: emailField,
    full_name: z.string().trim().min(1, "Name is required").max(120),
    role: userRoleSchema,
    location_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    can_enter_expenses: z.coerce.boolean().default(false),
  })
  .superRefine(roleLocationRefine);
export type InviteUserInput = z.infer<typeof InviteUserInput>;

// ----------------------------------------------------------------------------
// Update (role / location / flags)
// ----------------------------------------------------------------------------
export const UpdateUserInput = z
  .object({
    id: z.string().uuid(),
    full_name: z.string().trim().min(1).max(120),
    role: userRoleSchema,
    location_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    can_enter_expenses: z.coerce.boolean().default(false),
    active: z.coerce.boolean(),
  })
  .superRefine(roleLocationRefine);
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

// ----------------------------------------------------------------------------
// Activation toggle
// ----------------------------------------------------------------------------
export const ToggleUserActive = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

// ----------------------------------------------------------------------------
// Password reset (sends email)
// ----------------------------------------------------------------------------
export const ResetUserPasswordInput = z.object({
  id: z.string().uuid(),
});
