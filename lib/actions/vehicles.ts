"use server";

import { revalidatePath } from "next/cache";

import { wrapAction } from "@/lib/actions/_utils";
import {
  CreateVehicleInput,
  DeactivateVehicleInput,
  FindVehicleOwnerInput,
  SearchVehiclesInput,
  UpdateVehicleInput,
} from "@/lib/schemas/vehicles";
import { createClient } from "@/lib/supabase/server";
import { orFilterValue } from "@/lib/utils/parts-search";
import type { SalesJob, Vehicle } from "@/lib/db/types";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Which unique index a 23505 from the vehicles table came from.
function uniqueErrorToField(message: string | null | undefined): string | null {
  if (!message) return null;
  if (message.includes("vehicles_plate_active_uniq")) return "license_plate";
  if (message.includes("vehicles_vin_active_uniq")) return "vin";
  return null;
}

/** The active vehicle holding a plate or VIN, and the customer it's on. */
export interface VehicleOwner {
  vehicle_id: string;
  license_plate: string;
  /** Which of the two matched. */
  field: "license_plate" | "vin";
  customer_id: string | null;
  customer_name: string;
}

async function findVehicleOwner(
  supabase: SupabaseServer,
  field: "license_plate" | "vin",
  value: string,
  exceptId?: string,
): Promise<VehicleOwner | null> {
  const v = value.trim();
  if (!v) return null;
  // Same match as the unique index: case-insensitive, whole value.
  let query = supabase
    .from("vehicles")
    .select("id, license_plate, customer_id, customers:customer_id(billing_name, last_or_company)")
    .is("deactivated_at", null)
    .ilike(field, v.replace(/[\\%_]/g, (m) => `\\${m}`))
    .limit(1);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query;
  if (error) throw error;
  type Row = {
    id: string;
    license_plate: string;
    customer_id: string | null;
    customers: { billing_name: string | null; last_or_company: string | null } | { billing_name: string | null; last_or_company: string | null }[] | null;
  };
  const row = (data as Row[] | null)?.[0];
  if (!row) return null;
  const c = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  return {
    vehicle_id: row.id,
    license_plate: row.license_plate,
    field,
    customer_id: row.customer_id,
    customer_name: c?.billing_name ?? c?.last_or_company ?? "another customer",
  };
}

/**
 * A plate or VIN that's already taken, said in words: whose vehicle has it.
 * Before (client 2026-10-22) the form only said "Duplicate value", so staff
 * couldn't find the truck that was blocking them.
 */
async function duplicateVehicleError(
  supabase: SupabaseServer,
  field: "license_plate" | "vin",
  value: string,
  exceptId?: string,
): Promise<Error> {
  const owner = await findVehicleOwner(supabase, field, value, exceptId).catch(() => null);
  const what = field === "license_plate" ? `Plate ${value.toUpperCase()}` : `VIN ${value.toUpperCase()}`;
  // A plain Error (no PG code) so wrapAction shows this message as it is.
  return new Error(
    owner
      ? `${what} is already on a vehicle of ${owner.customer_name}.`
      : `${what} is already on another vehicle.`,
  );
}

/** Whose vehicle has this plate (or, failing that, this VIN) — null if none. */
export const getVehicleOwner = wrapAction({
  schema: FindVehicleOwnerInput,
  handler: async (input): Promise<VehicleOwner | null> => {
    const supabase = await createClient();
    if (input.license_plate) {
      const byPlate = await findVehicleOwner(supabase, "license_plate", input.license_plate, input.except_id);
      if (byPlate) return byPlate;
    }
    if (input.vin) return findVehicleOwner(supabase, "vin", input.vin, input.except_id);
    return null;
  },
});

// ----------------------------------------------------------------------------
// List by customer (vehicles tab on /customers/[id])
// ----------------------------------------------------------------------------
export async function getCustomerVehicles(customerId: string): Promise<Vehicle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("customer_id", customerId)
    .is("deactivated_at", null)
    .order("license_plate");
  if (error) throw error;
  return (data ?? []) as Vehicle[];
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Vehicle;
}

// ----------------------------------------------------------------------------
// Search by plate (or VIN) — used by the sales form combobox
// ----------------------------------------------------------------------------
export const searchVehicles = wrapAction({
  schema: SearchVehiclesInput,
  handler: async (input): Promise<Vehicle[]> => {
    const supabase = await createClient();
    let q = supabase
      .from("vehicles")
      .select("*")
      .is("deactivated_at", null)
      .order("license_plate")
      .limit(input.limit);

    if (input.customer_id) q = q.eq("customer_id", input.customer_id);

    if (input.q) {
      // Quoted: a comma or bracket in the search would break the filter.
      const term = orFilterValue(input.q.toUpperCase());
      q = q.or(`license_plate.ilike.${term},vin.ilike.${term}`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Vehicle[];
  },
});

// ----------------------------------------------------------------------------
// Create — DB unique indexes block duplicate plate / VIN (item #10)
// ----------------------------------------------------------------------------
export const createVehicle = wrapAction({
  schema: CreateVehicleInput,
  page: ["customers", "sales"],
  roles: ["owner", "co_owner", "manager", "staff"],
  handler: async (input, profile): Promise<Vehicle> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        ...input,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*");
    if (error) {
      const field = uniqueErrorToField(error.message);
      if (field === "license_plate") throw await duplicateVehicleError(supabase, field, input.license_plate);
      if (field === "vin" && input.vin) throw await duplicateVehicleError(supabase, field, input.vin);
      throw error;
    }
    // Deliberately avoid .single() on the insert read-back: if a policy or
    // trigger ever hides the just-inserted row, .single() throws the cryptic
    // PGRST116 "cannot coerce the result to a single JSON object" even though
    // the row WAS written. Take the first row and surface a clear message
    // instead so the user knows the vehicle saved and not to retry.
    const row = (data ?? [])[0] as Vehicle | undefined;
    if (!row) {
      throw new Error(
        "The vehicle was saved, but the app could not read it back. Please refresh the page to confirm — do not re-enter it.",
      );
    }
    revalidatePath(`/customers/${input.customer_id}`);
    return row;
  },
});

// ----------------------------------------------------------------------------
// Update
// ----------------------------------------------------------------------------
export const updateVehicle = wrapAction({
  schema: UpdateVehicleInput,
  page: "customers",
  roles: ["owner", "co_owner", "manager", "staff"],
  handler: async (input, profile): Promise<Vehicle> => {
    const supabase = await createClient();
    const { id, ...rest } = input;
    const { data, error } = await supabase
      .from("vehicles")
      .update({
        ...rest,
        updated_by: profile.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      const field = uniqueErrorToField(error.message);
      if (field === "license_plate") throw await duplicateVehicleError(supabase, field, rest.license_plate, id);
      if (field === "vin" && rest.vin) throw await duplicateVehicleError(supabase, field, rest.vin, id);
      throw error;
    }
    revalidatePath(`/customers/${input.customer_id}`);
    return data as Vehicle;
  },
});

// ----------------------------------------------------------------------------
// Mark contacted — stamps last_contacted_at with now()
// ----------------------------------------------------------------------------
export const markVehicleContacted = wrapAction({
  schema: DeactivateVehicleInput, // shares { id }
  page: "customers",
  roles: ["owner", "co_owner", "manager", "staff"],
  handler: async (input, profile): Promise<Vehicle> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .update({
        last_contacted_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/customers");
    return data as Vehicle;
  },
});

// ----------------------------------------------------------------------------
// Vehicle stats — last visit, # visits, total cost, avg km/day, cost per km/month
// (matches CARS Vehicle screen top-right panel)
// ----------------------------------------------------------------------------
/**
 * Every sales job done on this vehicle, newest first. Jobs recorded since
 * migration 0037 carry vehicle_id, but older jobs only snapshot the plate —
 * matching both (scoped to the vehicle's customer) keeps pre-link history
 * visible instead of starting the truck's file at 0037.
 */
export async function getVehicleSalesHistory(
  vehicle: Vehicle,
  limit = 100,
): Promise<SalesJob[]> {
  const supabase = await createClient();

  // Plates are plain alphanumerics; strip anything that would break the
  // PostgREST or() syntax rather than trying to escape it.
  const plate = (vehicle.license_plate ?? "").replace(/[,()%_\\]/g, "").trim();
  const ors = [`vehicle_id.eq.${vehicle.id}`];
  if (plate && vehicle.customer_id) {
    // ilike with no wildcard = case-insensitive exact match.
    ors.push(`and(customer_id.eq.${vehicle.customer_id},license_plate.ilike.${plate})`);
  }

  const { data, error } = await supabase
    .from("sales_jobs")
    .select("*")
    .or(ors.join(","))
    .is("deactivated_at", null)
    .order("job_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SalesJob[];
}

export interface VehicleStats {
  visit_count: number;
  last_visit_date: string | null;
  total_cost_excl_tax: number;
  avg_km_per_day: number | null;
  cost_per_km: number | null;
  cost_per_month: number | null;
}

export async function getVehicleStats(vehicleId: string): Promise<VehicleStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_jobs")
    .select("id, job_date, sub_total, odometer")
    .eq("vehicle_id", vehicleId)
    .is("deactivated_at", null)
    .order("job_date", { ascending: true });
  if (error) throw error;

  type Row = { id: string; job_date: string; sub_total: number; odometer: number | null };
  const rows = (data ?? []) as Row[];

  const visit_count = rows.length;
  const last_visit_date = rows.length > 0 ? rows[rows.length - 1].job_date : null;
  const total_cost_excl_tax = rows.reduce((s, r) => s + Number(r.sub_total ?? 0), 0);

  // First & last odometer with a value, plus elapsed days, gives km/day.
  const odometerRows = rows.filter((r) => r.odometer != null && r.odometer > 0);
  let avg_km_per_day: number | null = null;
  let totalKm = 0;
  if (odometerRows.length >= 2) {
    const first = odometerRows[0];
    const last = odometerRows[odometerRows.length - 1];
    totalKm = (last.odometer ?? 0) - (first.odometer ?? 0);
    const days =
      (new Date(last.job_date).getTime() - new Date(first.job_date).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days > 0 && totalKm > 0) {
      avg_km_per_day = totalKm / days;
    }
  }

  const cost_per_km = totalKm > 0 ? total_cost_excl_tax / totalKm : null;

  // Cost per month — total cost divided by # months between first and last visit.
  let cost_per_month: number | null = null;
  if (rows.length >= 2) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    const months =
      (new Date(last.job_date).getTime() - new Date(first.job_date).getTime()) /
      (1000 * 60 * 60 * 24 * 30.4375);
    if (months > 0) cost_per_month = total_cost_excl_tax / months;
  } else if (rows.length === 1) {
    // single visit — cost per month is just the visit cost
    cost_per_month = total_cost_excl_tax;
  }

  return {
    visit_count,
    last_visit_date,
    total_cost_excl_tax,
    avg_km_per_day,
    cost_per_km,
    cost_per_month,
  };
}

// ----------------------------------------------------------------------------
// Deactivate (owner-only — enforced by trigger)
// ----------------------------------------------------------------------------
export const deactivateVehicle = wrapAction({
  schema: DeactivateVehicleInput,
  page: "customers",
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<{ id: string }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("vehicles")
      .update({
        deactivated_at: new Date().toISOString(),
        deactivated_by: profile.id,
        updated_by: profile.id,
      })
      .eq("id", input.id);
    if (error) throw error;
    revalidatePath("/customers");
    return { id: input.id };
  },
});
