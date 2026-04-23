"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  CreateLocationInput,
  ToggleLocationActive,
  UpdateLocationInput,
} from "@/lib/schemas/locations";
import type { Location } from "@/lib/db/types";

export async function listLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Location[];
}

export const createLocation = wrapAction({
  schema: CreateLocationInput,
  roles: ["owner"],
  handler: async (input): Promise<Location> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .insert({
        code: input.code.toUpperCase(),
        name: input.name,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        active: input.active,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/locations");
    return data as Location;
  },
});

export const updateLocation = wrapAction({
  schema: UpdateLocationInput,
  roles: ["owner"],
  handler: async (input): Promise<Location> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .update({
        code: input.code.toUpperCase(),
        name: input.name,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        active: input.active,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/locations");
    return data as Location;
  },
});

export const toggleLocationActive = wrapAction({
  schema: ToggleLocationActive,
  roles: ["owner"],
  handler: async (input): Promise<Location> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/locations");
    return data as Location;
  },
});
