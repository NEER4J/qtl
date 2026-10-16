import { redirect } from "next/navigation";
import { getAuthClaims, getCurrentProfile } from "@/lib/auth/get-profile";
import { defaultLandingPath } from "@/lib/permissions/registry";

export default async function Home() {
  if (!(await getAuthClaims())) redirect("/auth/login");

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
