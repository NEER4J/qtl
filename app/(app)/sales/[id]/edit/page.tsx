import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SalesJobForm } from "@/components/sales/sales-job-form";
import { requireProfile } from "@/lib/auth/require";
import { getSalesJob } from "@/lib/actions/sales";
import {
  getAppSettings,
  listActiveLocations,
  listActiveServiceTypes,
} from "@/lib/actions/reference";
import { listEngineTypes, listOilTypes } from "@/lib/actions/pricing";
import { listActiveTechnicians } from "@/lib/actions/technicians";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function EditSalesJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const job = await getSalesJob(id);
  if (!job) notFound();

  // Only owner + manager (own location) can edit — staff and accountant cannot.
  const canEdit =
    (profile.role === "owner" || profile.role === "co_owner") ||
    (profile.role === "manager" && profile.location_id === job.location_id);
  if (!canEdit) redirect(`/sales/${id}`);
  if (job.deactivated_at) redirect(`/sales/${id}`);

  const [locations, serviceTypes, settings, engineTypes, oilTypes, technicians] =
    await Promise.all([
      listActiveLocations(),
      listActiveServiceTypes(),
      getAppSettings(),
      listEngineTypes(),
      listOilTypes(),
      listActiveTechnicians(),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={`/sales/${job.id}`}>
            <ChevronLeft className="size-4" /> Back to job
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          Edit #{job.invoice_no}
        </h1>
        <p className="text-sm text-muted-foreground">
          Created {formatDate(job.created_at)}
        </p>
      </div>

      <SalesJobForm
        mode="edit"
        locations={locations}
        serviceTypes={serviceTypes}
        engineTypes={engineTypes}
        oilTypes={oilTypes}
        technicians={technicians}
        hstRate={Number(settings.hst_rate)}
        initialItems={job.items.map((it) => ({
          key: it.id,
          part_id: it.part_id,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          is_taxable: it.is_taxable,
          unit_of_measure: it.unit_of_measure,
          package_label: it.package_label ?? null,
          is_customer_supplied: it.is_customer_supplied ?? false,
          part_category_id: it.part_category_id ?? null,
        }))}
        initial={{
          id: job.id,
          location_id: job.location_id,
          job_date: job.job_date,
          bay_no: job.bay_no?.toString() ?? "",
          upper_tech: job.upper_tech ?? "",
          lower_tech: job.lower_tech ?? "",
          invoice_no: job.invoice_no,
          customer_id: job.customer_id,
          vehicle_id: job.vehicle_id ?? null,
          billing_name: job.billing_name,
          billing_address: job.billing_address ?? "",
          business_phone: job.business_phone ?? "",
          alt_phone: job.alt_phone ?? "",
          customer_order_no: job.customer_order_no ?? "",
          unit_no: job.unit_no ?? "",
          vehicle_year: job.vehicle_year?.toString() ?? "",
          vehicle_make: job.vehicle_make ?? "",
          vehicle_model: job.vehicle_model ?? "",
          vin: job.vin ?? "",
          engine_size: job.engine_size ?? "",
          license_plate: job.license_plate ?? "",
          contact_no: job.contact_no ?? "",
          email: job.email ?? "",
          odometer: job.odometer?.toString() ?? "",
          service_type_id: job.service_type_id,
          advisor_name: job.advisor_name ?? "",
          start_time: job.start_time?.slice(0, 5) ?? "",
          end_time: job.end_time?.slice(0, 5) ?? "",
          free_grease_applied: job.free_grease_applied ?? false,
          free_grease_override_reason: job.free_grease_override_reason ?? "",
          comments: job.comments ?? "",
          sub_total: job.sub_total.toString(),
          hst: job.hst.toString(),
          total: job.total.toString(),
          paid_amount: job.paid_amount.toString(),
          payment_mode: job.payment_mode ?? "",
          engine_type_id: job.engine_type_id ?? "",
          oil_type_id: job.oil_type_id ?? "",
          oil_container: job.oil_container ?? "",
          auto_priced_at: job.auto_priced_at,
        }}
      />
    </div>
  );
}

