import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/get-profile";

// Settings is a SECTION, not a page. Each leaf (users, locations, audit-log…)
// enforces its own role gate via requireRole / notFound. Settings is now
// managed by the Admin (co_owner) only — owner no longer has the Settings
// section — so anyone but co_owner is bounced.
const SETTINGS_ROLES = new Set(["co_owner"]);

export default async function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");
  if (!SETTINGS_ROLES.has(profile.role)) redirect("/dashboard");

  return <>{children}</>;
}
