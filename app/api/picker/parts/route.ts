import { NextResponse } from "next/server";

import { listAllPartsForPicker } from "@/lib/actions/pricing";
import { getCurrentProfile } from "@/lib/auth/get-profile";

export const dynamic = "force-dynamic";

// The active parts catalogue, priced, for the sales form's part and return
// pickers to search in the browser. A GET route so loading it never queues
// behind (or holds up) the form's server actions.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) return new Response("Unauthorized", { status: 401 });
  if (profile.role === "portal_customer") return new Response("Forbidden", { status: 403 });

  return NextResponse.json(await listAllPartsForPicker(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
