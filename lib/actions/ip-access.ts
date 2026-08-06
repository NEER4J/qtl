"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import { REFERENCE_TAGS, revalidateReference } from "@/lib/cache/reference";
import {
  CreateIpRuleInput,
  DeleteIpRuleInput,
  SetIpLockEnabledInput,
  ToggleIpRuleActive,
  UpdateIpRuleInput,
} from "@/lib/schemas/ip-access";
import type { IpAllowlistEntryWithLocation } from "@/lib/db/types";

const PAGE = "/settings/ip-access";

export async function listIpRules(): Promise<IpAllowlistEntryWithLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ip_allowlist")
    .select("*, location:locations(name)")
    .order("active", { ascending: false })
    .order("label");
  if (error) throw error;
  return (data ?? []) as IpAllowlistEntryWithLocation[];
}

export async function getIpLockEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("ip_lock_enabled")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return Boolean(data?.ip_lock_enabled);
}

export const createIpRule = wrapAction({
  schema: CreateIpRuleInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<IpAllowlistEntryWithLocation> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ip_allowlist")
      .insert({
        label: input.label,
        network: input.network,
        location_id: input.location_id || null,
        note: input.note || null,
        active: input.active,
        created_by: profile.id,
      })
      .select("*, location:locations(name)")
      .single();
    if (error) throw error;
    revalidatePath(PAGE);
    return data as IpAllowlistEntryWithLocation;
  },
});

export const updateIpRule = wrapAction({
  schema: UpdateIpRuleInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<IpAllowlistEntryWithLocation> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ip_allowlist")
      .update({
        label: input.label,
        network: input.network,
        location_id: input.location_id || null,
        note: input.note || null,
        active: input.active,
      })
      .eq("id", input.id)
      .select("*, location:locations(name)")
      .single();
    if (error) throw error;
    revalidatePath(PAGE);
    return data as IpAllowlistEntryWithLocation;
  },
});

export const toggleIpRuleActive = wrapAction({
  schema: ToggleIpRuleActive,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<IpAllowlistEntryWithLocation> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ip_allowlist")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*, location:locations(name)")
      .single();
    if (error) throw error;
    revalidatePath(PAGE);
    return data as IpAllowlistEntryWithLocation;
  },
});

export const deleteIpRule = wrapAction({
  schema: DeleteIpRuleInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ id: string }> => {
    const supabase = await createClient();
    const { error } = await supabase.from("ip_allowlist").delete().eq("id", input.id);
    if (error) throw error;
    revalidatePath(PAGE);
    return { id: input.id };
  },
});

export const setIpLockEnabled = wrapAction({
  schema: SetIpLockEnabledInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ enabled: boolean }> => {
    const supabase = await createClient();

    // Turning the lock on with no rules is a no-op at the DB level (the
    // check function treats it as "not configured" and lets everyone in), so
    // refuse it here rather than leave a switch that reads ON but does nothing.
    if (input.enabled) {
      const { count, error: countError } = await supabase
        .from("ip_allowlist")
        .select("id", { count: "exact", head: true })
        .eq("active", true);
      if (countError) throw countError;
      if (!count) {
        throw new Error(
          "Add at least one active allowed IP before turning the lock on.",
        );
      }
    }

    const { error } = await supabase
      .from("app_settings")
      .update({ ip_lock_enabled: input.enabled })
      .eq("id", 1);
    if (error) throw error;
    revalidateReference(REFERENCE_TAGS.appSettings);
    revalidatePath(PAGE);
    return { enabled: input.enabled };
  },
});
