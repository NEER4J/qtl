import { z } from "zod";

// ----------------------------------------------------------------------------
// Self-service profile edits. Unlike lib/schemas/users.ts (admin editing any
// user), these only ever apply to the *caller's own* row, so there is no id,
// role, or location — just the fields a user may change about themselves.
// ----------------------------------------------------------------------------

export const UpdateOwnProfileInput = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
});
export type UpdateOwnProfileInput = z.infer<typeof UpdateOwnProfileInput>;

export const ChangeOwnPasswordInput = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(72, "Password is too long"),
    confirm_password: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  })
  .refine((d) => d.new_password !== d.current_password, {
    path: ["new_password"],
    message: "New password must be different from the current one",
  });
export type ChangeOwnPasswordInput = z.infer<typeof ChangeOwnPasswordInput>;
