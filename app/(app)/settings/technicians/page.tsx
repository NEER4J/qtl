import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllTechnicians } from "@/lib/actions/technicians";

import { TechniciansTable } from "./technicians-table";

export const dynamic = "force-dynamic";

export default async function TechniciansPage() {
  await requireRole("owner", "co_owner");
  const rows = await listAllTechnicians();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Technicians</h1>
        <p className="text-sm text-muted-foreground">
          Names that appear in the Upper tech / Lower tech / Advisor dropdowns on a sales job.
        </p>
      </div>

      <PageHelp id="settings-technicians">
        <p>
          This roster feeds the technician pickers on the New Job form. People listed here are
          <strong> not</strong> login users — they&apos;re just labels for who worked which job.
        </p>
        <ul>
          <li><strong>Role</strong> is informational only (Technician, Front Counter, etc.) — every name shows up in every dropdown.</li>
          <li><strong>Deactivate</strong> hides a name from new jobs but keeps it on past jobs intact.</li>
          <li><strong>Rename</strong> updates the roster only; existing sales jobs keep the name they were saved with.</li>
        </ul>
      </PageHelp>

      <TechniciansTable rows={rows} />
    </div>
  );
}
