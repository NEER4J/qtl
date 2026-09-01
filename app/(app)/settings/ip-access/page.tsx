import { headers } from "next/headers";

import { PageHelp } from "@/components/help/page-help";
import { requirePage } from "@/lib/auth/require";
import { getIpLockEnabled, listIpRules } from "@/lib/actions/ip-access";
import { listLocations } from "@/lib/actions/locations";
import { clientIpFromHeaders } from "@/lib/security/client-ip";

import { IpAccessManager } from "./ip-access-manager";

export const dynamic = "force-dynamic";

export default async function IpAccessPage() {
  // Settings is the Admin section, but each leaf enforces its own gate.
  await requirePage("settings_ip_access");

  const [enabled, rules, locations] = await Promise.all([
    getIpLockEnabled(),
    listIpRules(),
    listLocations(),
  ]);

  const currentIp = clientIpFromHeaders(await headers());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">IP access</h1>
        <p className="text-sm text-muted-foreground">
          Limit the platform to the shops&apos; own networks, so a stolen
          password alone can&apos;t be used from somewhere else.
        </p>
      </div>

      <PageHelp id="settings-ip-access" defaultOpen>
        <p>
          When the lock is on, anyone signing in from an address that
          isn&apos;t listed below is turned away — even with the correct
          password.
        </p>
        <ul>
          <li>
            <strong>Admins are never locked out.</strong> Your role (Admin)
            works from any network, by design — otherwise a mistyped range
            would lock you out of this very page.
          </li>
          <li>
            <strong>Add your shop&apos;s address first,</strong> then turn the
            lock on. The switch refuses to turn on while the list is empty.
          </li>
          <li>
            <strong>Single machine or whole office.</strong> Enter one address
            (<code>203.0.113.7</code>) or a range in CIDR form
            (<code>203.0.113.0/24</code> = the 256 addresses of that office).
          </li>
          <li>
            <strong>Watch out for changing home internet.</strong> Most home
            connections get a new address periodically — for staff working off
            site, ask your provider for a static IP rather than listing a
            temporary one.
          </li>
          <li>
            The customer invoice portal is never restricted — customers
            aren&apos;t on your network.
          </li>
        </ul>
      </PageHelp>

      <IpAccessManager
        enabled={enabled}
        rules={rules}
        locations={locations.filter((l) => l.active)}
        currentIp={currentIp}
      />
    </div>
  );
}
