"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import { REFERENCE_TAGS, revalidateReference } from "@/lib/cache/reference";
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
  roles: ["owner", "co_owner"],
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
        invoice_name: input.invoice_name || null,
        fax: input.fax || null,
        hst_number: input.hst_number || null,
        active: input.active,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidateReference(REFERENCE_TAGS.locations);
    revalidatePath("/settings/locations");
    return data as Location;
  },
});

export const updateLocation = wrapAction({
  schema: UpdateLocationInput,
  roles: ["owner", "co_owner"],
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
        invoice_name: input.invoice_name || null,
        fax: input.fax || null,
        hst_number: input.hst_number || null,
        active: input.active,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidateReference(REFERENCE_TAGS.locations);
    revalidatePath("/settings/locations");
    return data as Location;
  },
});

export const toggleLocationActive = wrapAction({
  schema: ToggleLocationActive,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Location> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidateReference(REFERENCE_TAGS.locations);
    revalidatePath("/settings/locations");
    return data as Location;
  },
});
