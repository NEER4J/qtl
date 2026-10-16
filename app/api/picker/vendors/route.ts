import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Every active vendor (~60) for the expense form's vendor picker to search in
// the browser. A GET route for the same reason as app/api/picker/customers.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) return new Response("Unauthorized", { status: 401 });
  if (profile.role === "portal_customer") return new Response("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) return new Response(error.message, { status: 500 });

  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "private, no-store" } });
}
