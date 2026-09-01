import { ReactNode } from "react";

import { requireAnyPage } from "@/lib/auth/require";
import { settingsPageKeys } from "@/lib/permissions/check";

// Settings is a SECTION, not a page. Each leaf (users, locations, audit-log…)
// enforces its own gate via requirePage(). This layout only checks that the
// viewer can reach *something* in here, so it never hides a leaf the
// permissions matrix has granted.
//
// It used to be a hard `role === "co_owner"` check, which silently overrode
// every per-user grant: ticking "Users" for a manager saved fine and then
// bounced them to /dashboard on arrival.
export default async function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireAnyPage(settingsPageKeys());

  return <>{children}</>;
}
