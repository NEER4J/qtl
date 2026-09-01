import { z } from "zod";

import { userRoleSchema } from "@/lib/schemas/common";

// ----------------------------------------------------------------------------
// Shared refinements
// ----------------------------------------------------------------------------
const optionalEmailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email")
  .or(z.literal(""))
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(40, "Username is too long")
  .regex(
    /^[a-z0-9_.\-]+$/,
    "Use letters, numbers, dots, underscores, or hyphens only",
  )
  .nullable()
  .optional();

/** Roles that authenticate by username. Owner and accountant log in with a
 *  real email; everyone else — including the co_owner "Admin" — logs in with a
 *  username. For these roles email is OPTIONAL: if provided it becomes the
 *  account's real auth email (so they can sign in with the username OR that
 *  email); if omitted, a synthetic <username>@team.qtl.app address is used
 *  under the hood so Supabase Auth still has an address. */
export const USERNAME_LOGIN_ROLES = ["co_owner", "manager", "supervisor", "staff", "technician", "employee"] as const;
type UsernameRole = (typeof USERNAME_LOGIN_ROLES)[number];

export function isUsernameRole(role: string): role is UsernameRole {
  return (USERNAME_LOGIN_ROLES as readonly string[]).includes(role);
}

/** Internal synthetic email used for username-only accounts.
 *  Uses `.app` (a real TLD with no DNS / MX validation surprises) so Supabase
 *  Auth's email validator always accepts it. The address is not deliverable
 *  by design — the user only ever types `<username>` on the login screen. */
export function syntheticEmailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@team.qtl.app`;
}

/** True if a given profiles.email row is a synthetic team-login address. */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && (email.endsWith("@team.qtl.app") || email.endsWith("@team.qtl.local"));
}

const roleLocationRefine = (
  data: { role: z.infer<typeof userRoleSchema>; location_id: string | null },
  ctx: z.RefinementCtx,
) => {
  if (
    (data.role === "manager" ||
      data.role === "supervisor" ||
      data.role === "staff" ||
      data.role === "technician" ||
      data.role === "employee") &&
    !data.location_id
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["location_id"],
      message: `${data.role[0].toUpperCase()}${data.role.slice(1)} must be assigned to a location`,
    });
  }
};

const identityRefine = (
  data: {
    role: z.infer<typeof userRoleSchema>;
    email?: string | null;
    username?: string | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (isUsernameRole(data.role)) {
    if (!data.username) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["username"],
        message: "Username is required for this role",
      });
    }
  } else {
    if (!data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Email is required for this role",
      });
    }
  }
};

// ----------------------------------------------------------------------------
// Permission overrides
// ----------------------------------------------------------------------------
/** NULL = use role default; array = explicit allowlist. */
export const AllowedPagesField = z.array(z.string().min(1)).nullable().optional();

/**
 * Explicit multi-location grant (migration 0137). NULL = not in "Multiple"
 * mode — the user falls back to `location_id` alone, or to every location when
 * `cross_location` is set. The dialogs normalise this via locationAccessForSave()
 * in lib/auth/locations.ts, so a 0- or 1-entry selection arrives here as null.
 */
export const LocationIdsField = z
  .array(z.string().uuid())
  .min(2, "Pick at least two locations, or use Single instead")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** Hidden columns by pageKey. Missing key = all visible. */
export const HiddenColumnsField = z
  .record(z.array(z.string().min(1)))
  .default({});

// ----------------------------------------------------------------------------
// Invite (admin creates user directly with a password)
// ----------------------------------------------------------------------------
const passwordField = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(72, "Password is too long");

export const InviteUserInput = z
  .object({
    email: optionalEmailField,
    username: usernameField,
    full_name: z.string().trim().min(1, "Name is required").max(120),
    role: userRoleSchema,
    location_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    can_enter_expenses: z.coerce.boolean().default(false),
    cross_location: z.coerce.boolean().default(false),
    location_ids: LocationIdsField,
    password: passwordField,
    allowed_pages: AllowedPagesField,
    hidden_columns: HiddenColumnsField,
  })
  .superRefine(roleLocationRefine)
  .superRefine(identityRefine);
export type InviteUserInput = z.infer<typeof InviteUserInput>;

// ----------------------------------------------------------------------------
// Update (role / location / flags)
// ----------------------------------------------------------------------------
export const UpdateUserInput = z
  .object({
    id: z.string().uuid(),
    email: optionalEmailField,
    username: usernameField,
    full_name: z.string().trim().min(1).max(120),
    role: userRoleSchema,
    location_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    can_enter_expenses: z.coerce.boolean().default(false),
    cross_location: z.coerce.boolean().default(false),
    location_ids: LocationIdsField,
    active: z.coerce.boolean(),
    allowed_pages: AllowedPagesField,
    hidden_columns: HiddenColumnsField,
  })
  .superRefine(roleLocationRefine)
  .superRefine(identityRefine);
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

// ----------------------------------------------------------------------------
// Activation toggle
// ----------------------------------------------------------------------------
export const ToggleUserActive = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

// ----------------------------------------------------------------------------
// Set password directly (admin-set)
// ----------------------------------------------------------------------------
export const SetUserPasswordInput = z.object({
  id: z.string().uuid(),
  password: passwordField,
});
export type SetUserPasswordInput = z.infer<typeof SetUserPasswordInput>;

// ----------------------------------------------------------------------------
// Permissions-only update — for the matrix UI
// ----------------------------------------------------------------------------
export const UpdateUserPermissionsInput = z.object({
  id: z.string().uuid(),
  allowed_pages: AllowedPagesField,
  hidden_columns: HiddenColumnsField,
});
export type UpdateUserPermissionsInput = z.infer<typeof UpdateUserPermissionsInput>;

// ----------------------------------------------------------------------------
// Bulk actions (Users list page)
// ----------------------------------------------------------------------------
export const BulkUserAction = z.object({
  ids: z.array(z.string().uuid()).min(1, "Pick at least one user"),
  action: z.enum(["deactivate", "reactivate", "delete"]),
});
export type BulkUserAction = z.infer<typeof BulkUserAction>;

// ----------------------------------------------------------------------------
// Apply role-default permissions — clears any per-user override so the
// selected users fall back to their role's defaults (the staff access matrix).
// ----------------------------------------------------------------------------
export const ApplyDefaultPermissionsInput = z.object({
  ids: z.array(z.string().uuid()).min(1, "Pick at least one user"),
});
export type ApplyDefaultPermissionsInput = z.infer<typeof ApplyDefaultPermissionsInput>;
