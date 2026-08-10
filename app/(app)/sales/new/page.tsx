import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/help/page-help";
import { SalesJobForm } from "@/components/sales/sales-job-form";
import { requireProfile } from "@/lib/auth/require";
import {
  getAppSettings,
  listActiveLocations,
  listActiveServiceTypes,
} from "@/lib/actions/reference";
import { listEngineTypes, listOilTypes } from "@/lib/actions/pricing";
import { listActiveTechnicians } from "@/lib/actions/technicians";

export const dynamic = "force-dynamic";

export default async function NewSalesJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; vehicle_id?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "accountant" || profile.role === "employee") {
    redirect("/sales");
  }

  const { customer_id: preselectCustomerId, vehicle_id: preselectVehicleId } =
    await searchParams;

  const [locations, serviceTypes, settings, engineTypes, oilTypes, technicians] =
    await Promise.all([
      listActiveLocations(),
      listActiveServiceTypes(),
      getAppSettings(),
      listEngineTypes(),
      listOilTypes(),
      listActiveTechnicians(),
    ]);

  const lockedLocationId = profile.role === "staff" ? profile.location_id : null;

  return (
    <div className="flex flex-col gap-4">
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

      <PageHelp id="sales-new">
        <p>Quick guide to each field:</p>
        <ul>
          <li><strong>Customer</strong> — start typing a name or license plate to find existing customers. If they&apos;re brand new, just type the billing name; a customer record is created automatically when you save.</li>
          <li><strong>Invoice number</strong> — whatever you use on your written invoice. It has to be unique within the shop; if you try to reuse one, the form will tell you.</li>
          <li><strong>Sub total / HST / Total</strong> — enter the sub total. HST is calculated at 13% automatically; the total updates as you type.</li>
          <li><strong>Payment mode and amount paid</strong> — if the customer paid in full, the status becomes &quot;Paid&quot;. Partial payment shows as &quot;Partial&quot;. Leave it blank for &quot;Outstanding&quot; and record payment later.</li>
          <li><strong>Start / end time</strong> — optional, but recording them lets the analytics tell you how long different jobs take and which bay is fastest.</li>
        </ul>
        <p>
          Staff can only create jobs at their own shop. Once saved, staff can&apos;t edit — ask a manager or owner to fix anything.
        </p>
      </PageHelp>

      <SalesJobForm
        mode="create"
        locations={locations}
        serviceTypes={serviceTypes}
        engineTypes={engineTypes}
        oilTypes={oilTypes}
        technicians={technicians}
        hstRate={Number(settings.hst_rate)}
        dumpTruckSurcharge={Number(settings.dump_truck_surcharge ?? 0)}
        lockedLocationId={lockedLocationId}
        currentUserRole={profile.role}
        initial={
          preselectCustomerId
            ? { customer_id: preselectCustomerId, vehicle_id: preselectVehicleId ?? null }
            : undefined
        }
      />
    </div>
  );
}
