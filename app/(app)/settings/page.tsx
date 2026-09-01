import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth/require";
import { effectiveAllowedPageKeys } from "@/lib/permissions/check";
import { PAGE_REGISTRY } from "@/lib/permissions/registry";

// The Settings hub has no content of its own — it forwards to the first
// Settings page the viewer can actually open. Hard-coding /settings/users here
// used to bounce anyone granted, say, only "Locations" straight back out via
// that page's own gate.
export default async function SettingsIndex() {
  const profile = await requireProfile();
  const allowed = effectiveAllowedPageKeys(profile);
  const first = PAGE_REGISTRY.find(
    (p) => p.group === "Settings" && p.key !== "settings" && allowed.has(p.key),
  );
  redirect(first?.path ?? "/dashboard");
}
