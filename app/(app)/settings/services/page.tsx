import { PageHelp } from "@/components/help/page-help";
import { requirePage } from "@/lib/auth/require";
import { listAllServiceTypes } from "@/lib/actions/services";

import { ServicesTable } from "./services-table";

export const dynamic = "force-dynamic";

export default async function SettingsServicesPage() {
  await requirePage("settings_services");
  const services = await listAllServiceTypes();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service types</h1>
        <p className="text-sm text-muted-foreground">
          Manage service types used when creating sales jobs (e.g. Oil Change, Pit Grease).
        </p>
      </div>
      <PageHelp id="settings-services">
        <p>
          The kinds of jobs a truck can come in for: oil change (OC), premium grease (PG), full grease (FG), and miscellaneous. The short code appears in reports.
        </p>
        <ul>
          <li>Every sales job has exactly one service type.</li>
          <li>You can rename the display name any time. The short code stays the same.</li>
          <li>Deactivating a service type hides it from the sales form but keeps it on any past jobs.</li>
        </ul>
      </PageHelp>

      <ServicesTable services={services} />
    </div>
  );
}
