import { NextResponse } from "next/server";

import { listTransServicesForPicker } from "@/lib/actions/pricing";
import { getCurrentProfile } from "@/lib/auth/get-profile";

export const dynamic = "force-dynamic";

// Every active Trans & Diff service (18 today; the action caps at 100) for the
// sales form to search in the browser. A GET route for the same reason as
// app/api/picker/parts.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) return new Response("Unauthorized", { status: 401 });
  if (profile.role === "portal_customer") return new Response("Forbidden", { status: 403 });

  return NextResponse.json(await listTransServicesForPicker(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
