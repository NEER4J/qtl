"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  CreatePromotionInput,
  TogglePromotionActiveInput,
  UpdatePromotionInput,
} from "@/lib/schemas/promotions";
import type { Promotion } from "@/lib/db/types";

function revalidatePromotions() {
  revalidatePath("/settings/promotions");
  revalidatePath("/sales");
  revalidatePath("/expenses");
}

/** All promotions (active + inactive) for the management table. */
export async function listAllPromotions(): Promise<Promotion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .order("active", { ascending: false })
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Promotion[];
}

/** Active promotions only — for the sales-job / expense pickers. */
export async function listActivePromotions(): Promise<Promotion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Promotion[];
}

export const createPromotion = wrapAction({
  schema: CreatePromotionInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<Promotion> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("promotions")
      .insert({ ...input, created_by: profile.id, updated_by: profile.id })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePromotions();
    return data as Promotion;
  },
});

export const updatePromotion = wrapAction({
  schema: UpdatePromotionInput,
  roles: ["owner", "co_owner"],
  handler: async ({ id, ...fields }, profile): Promise<Promotion> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("promotions")
      .update({ ...fields, updated_by: profile.id })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePromotions();
    return data as Promotion;
  },
});

export const togglePromotionActive = wrapAction({
  schema: TogglePromotionActiveInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<Promotion> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("promotions")
      .update({ active: input.active, updated_by: profile.id })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePromotions();
    return data as Promotion;
  },
});
