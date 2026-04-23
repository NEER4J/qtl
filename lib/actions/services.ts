"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import type { ServiceType } from "@/lib/db/types";

export async function listAllServiceTypes(): Promise<ServiceType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_types")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ServiceType[];
}

const ServiceTypeInput = z.object({
  code: z.string().trim().toUpperCase().min(1).max(10),
  name: z.string().trim().min(1, "Name is required").max(100),
  sort_order: z.coerce.number().int().min(0).default(0),
});
const UpdateServiceTypeInput = ServiceTypeInput.extend({ id: z.string().uuid() });

export const createServiceType = wrapAction({
  schema: ServiceTypeInput,
  roles: ["owner"],
  handler: async (input): Promise<ServiceType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_types")
      .insert({ code: input.code as ServiceType["code"], name: input.name, sort_order: input.sort_order })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/services");
    return data as ServiceType;
  },
});

export const updateServiceType = wrapAction({
  schema: UpdateServiceTypeInput,
  roles: ["owner"],
  handler: async (input): Promise<ServiceType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_types")
      .update({ code: input.code as ServiceType["code"], name: input.name, sort_order: input.sort_order })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/services");
    return data as ServiceType;
  },
});

export const toggleServiceTypeActive = wrapAction({
  schema: z.object({ id: z.string().uuid(), active: z.boolean() }),
  roles: ["owner"],
  handler: async (input): Promise<ServiceType> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_types")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/services");
    return data as ServiceType;
  },
});
