"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  CreateTechnicianInput,
  ToggleTechnicianActiveInput,
  UpdateTechnicianInput,
} from "@/lib/schemas/technicians";
import type { Technician } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// Reads. Sales-job form uses listActiveTechnicians; settings page uses
// listAllTechnicians.
// ----------------------------------------------------------------------------
export async function listActiveTechnicians(): Promise<Technician[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technicians")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Technician[];
}

export async function listAllTechnicians(): Promise<Technician[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technicians")
    .select("*")
    .order("active", { ascending: false })
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Technician[];
}

// ----------------------------------------------------------------------------
// Writes — owner-only via RLS + wrapAction roles guard.
// ----------------------------------------------------------------------------
function revalidateTech() {
  revalidatePath("/settings/technicians");
  revalidatePath("/sales/new");
  revalidatePath("/sales");
}

export const createTechnician = wrapAction({
  schema: CreateTechnicianInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Technician> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("technicians")
      .insert({ ...input, name: input.name.trim() })
      .select("*")
      .single();
    if (error) throw error;
    revalidateTech();
    return data as Technician;
  },
});

export const updateTechnician = wrapAction({
  schema: UpdateTechnicianInput,
  roles: ["owner", "co_owner"],
  handler: async ({ id, ...fields }): Promise<Technician> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("technicians")
      .update({ ...fields, name: fields.name.trim() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidateTech();
    return data as Technician;
  },
});

export const toggleTechnicianActive = wrapAction({
  schema: ToggleTechnicianActiveInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Technician> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("technicians")
      .update({
        active: input.active,
        deactivated_at: input.active ? null : new Date().toISOString(),
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidateTech();
    return data as Technician;
  },
});
