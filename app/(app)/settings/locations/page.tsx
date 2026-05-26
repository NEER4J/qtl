import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listLocations } from "@/lib/actions/locations";
import { LocationsTable } from "./locations-table";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  // Owner-only per registry. Settings layout admits other roles for the
  // section as a whole, so this leaf must enforce its own gate.
  await requireRole("owner", "co_owner");
  const locations = await listLocations();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Manage the QTL shop locations. Locations cannot be deleted — deactivate instead.
          </p>
        </div>
      </div>
      <PageHelp id="settings-locations">
        <p>
          Each entry is a physical QTL shop. Every sales job, expense, payroll week, and manager belongs to one of them.
        </p>
        <ul>
          <li><strong>Start here when setting up.</strong> Users, sales, expenses and payroll all need a shop assigned, so add your shops before inviting staff.</li>
          <li><strong>Code</strong> (AYR, FE, NP) is used in invoice prefixes and reports. Keep it short.</li>
          <li><strong>Deactivate</strong> hides a shop from forms but keeps all its history.</li>
          <li>You can&apos;t fully delete a shop — too much history depends on it. Deactivate instead.</li>
        </ul>
      </PageHelp>

      <LocationsTable locations={locations} />
    </div>
  );
}
