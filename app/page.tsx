import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { defaultLandingPath } from "@/lib/permissions/registry";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Send the signed-in user to a page they can actually reach. Without this,
  // login always pushed to /dashboard, which the (app) layout then bounced
  // again for roles that don't have dashboard in their allowlist (e.g. staff).
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.active) redirect("/auth/login?error=account_disabled");

  const path = defaultLandingPath({
    role: profile.role,
    allowedPages: profile.allowed_pages,
  });
  redirect(path ?? "/auth/login?error=no_access");
}
