import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRowsParallel } from "@/lib/supabase/fetch-all";
import type { CustomerPickerTuple } from "@/lib/utils/customer-picker";

export const dynamic = "force-dynamic";

// Every active customer the caller can see, for the sales form to search in
// the browser (components/sales/customer-combobox.tsx). A GET route rather
// than a server action: Next runs actions one at a time, so loading this list
// through one would hold up the customer-context read that follows a pick.
// Visibility is the caller's own RLS, the same as searchCustomers.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) return new Response("Unauthorized", { status: 401 });
  if (profile.role === "portal_customer") return new Response("Forbidden", { status: 403 });

  const supabase = await createClient();
  type CustomerRow = {
    id: string;
    billing_name: string | null;
    last_or_company: string | null;
    phone_search: string | null;
    plates_text: string | null;
  };
  type VehicleRow = { customer_id: string | null; license_plate: string | null };

  const [customers, vehicles] = await Promise.all([
    fetchAllRowsParallel<CustomerRow>((from, to, count) =>
      supabase
        .from("customers")
        .select("id, billing_name, last_or_company, phone_search, plates_text", { count })
        .eq("active", true)
        .order("billing_name")
        .order("id")
        .range(from, to),
    ),
    // Plates live on vehicles (the source of truth searchCustomers used).
    fetchAllRowsParallel<VehicleRow>((from, to, count) =>
      supabase
        .from("vehicles")
        .select("customer_id, license_plate", { count })
        .is("deactivated_at", null)
        .not("license_plate", "is", null)
        .order("id")
        .range(from, to),
    ),
  ]);

  const platesByCustomer = new Map<string, string[]>();
  for (const v of vehicles) {
    const plate = v.license_plate?.trim();
    if (!v.customer_id || !plate) continue;
    const list = platesByCustomer.get(v.customer_id) ?? [];
    if (!list.includes(plate)) list.push(plate);
    platesByCustomer.set(v.customer_id, list);
  }

  const body: CustomerPickerTuple[] = customers.map((c) => [
    c.id,
    c.billing_name,
    c.last_or_company && c.last_or_company !== c.billing_name ? c.last_or_company : null,
    c.phone_search || null,
    platesByCustomer.get(c.id) ?? [],
    c.plates_text?.trim() || null,
  ]);

  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
