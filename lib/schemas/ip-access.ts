import { z } from "zod";

import { normalizeCidr } from "@/lib/security/cidr";

// The network field accepts what an admin would naturally type — a bare address
// ("203.0.113.7") or a range ("203.0.113.0/24") — and transforms it into the
// canonical CIDR that Postgres' `cidr` column will accept.
const NetworkInput = z
  .string()
  .trim()
  .min(1, "Enter an IP address or range")
  .superRefine((value, ctx) => {
    const result = normalizeCidr(value);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    }
  })
  .transform((value) => {
    const result = normalizeCidr(value);
    return result.ok ? result.value : value;
  });

export const CreateIpRuleInput = z.object({
  label: z.string().trim().min(1, "Name is required").max(120),
  network: NetworkInput,
  location_id: z.string().uuid().optional().nullable().or(z.literal("")),
  note: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  active: z.coerce.boolean().default(true),
});
export type CreateIpRuleInput = z.infer<typeof CreateIpRuleInput>;

export const UpdateIpRuleInput = CreateIpRuleInput.extend({
  id: z.string().uuid(),
});
export type UpdateIpRuleInput = z.infer<typeof UpdateIpRuleInput>;

export const ToggleIpRuleActive = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});
export type ToggleIpRuleActive = z.infer<typeof ToggleIpRuleActive>;

export const DeleteIpRuleInput = z.object({
  id: z.string().uuid(),
});
export type DeleteIpRuleInput = z.infer<typeof DeleteIpRuleInput>;

export const SetIpLockEnabledInput = z.object({
  enabled: z.boolean(),
});
export type SetIpLockEnabledInput = z.infer<typeof SetIpLockEnabledInput>;
