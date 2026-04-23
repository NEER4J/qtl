import { requireRole } from "@/lib/auth/require";
import { listAllServiceTypes } from "@/lib/actions/services";

import { ServicesTable } from "./services-table";

export const dynamic = "force-dynamic";

export default async function SettingsServicesPage() {
  await requireRole("owner");
  const services = await listAllServiceTypes();

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service types</h1>
        <p className="text-sm text-muted-foreground">
          Manage service types used when creating sales jobs (e.g. Oil Change, Pit Grease).
        </p>
      </div>
      <ServicesTable services={services} />
    </div>
  );
}
