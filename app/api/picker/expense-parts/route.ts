import { NextResponse } from "next/server";

import { listAllPartsForExpensePicker } from "@/lib/actions/expenses";
import { getCurrentProfile } from "@/lib/auth/get-profile";

export const dynamic = "force-dynamic";

// Every active part with its last buying price, for the expense form's part
// picker to search in the browser. A GET route for the same reason as
// app/api/picker/parts.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) return new Response("Unauthorized", { status: 401 });
  if (profile.role === "portal_customer") return new Response("Forbidden", { status: 403 });

  return NextResponse.json(await listAllPartsForExpensePicker(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
