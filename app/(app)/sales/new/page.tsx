import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SalesJobForm } from "@/components/sales/sales-job-form";
import { requireProfile } from "@/lib/auth/require";
import {
  getAppSettings,
  listActiveLocations,
  listActiveServiceTypes,
} from "@/lib/actions/reference";

export const dynamic = "force-dynamic";

export default async function NewSalesJobPage() {
  const profile = await requireProfile();
  if (profile.role === "accountant" || profile.role === "employee") {
    redirect("/sales");
  }

  const [locations, serviceTypes, settings] = await Promise.all([
    listActiveLocations(),
    listActiveServiceTypes(),
    getAppSettings(),
  ]);

  const lockedLocationId = profile.role === "staff" ? profile.location_id : null;

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/sales">
              <ChevronLeft className="size-4" /> Back to sales
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">New job</h1>
          <p className="text-sm text-muted-foreground">
            Record a sale. HST is computed automatically from the sub total.
          </p>
        </div>
      </div>

      <SalesJobForm
        mode="create"
        locations={locations}
        serviceTypes={serviceTypes}
        hstRate={Number(settings.hst_rate)}
        lockedLocationId={lockedLocationId}
      />
    </div>
  );
}
