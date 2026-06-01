import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/get-profile";

// Settings is a SECTION, not a page. Each leaf (users, locations, audit-log…)
// enforces its own role gate via requireRole / notFound. Per the staff access
// matrix every Settings row is owner-only, so the section is gated to
// owner / co_owner; all other roles are bounced.
const SETTINGS_ROLES = new Set(["owner", "co_owner"]);

export default async function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");
  if (!SETTINGS_ROLES.has(profile.role)) redirect("/dashboard");

  return <>{children}</>;
}
