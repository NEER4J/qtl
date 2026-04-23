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
    profile.role === "owner" ||
    (profile.role === "manager" && profile.location_id === job.location_id);
  if (!canEdit) redirect(`/sales/${id}`);
  if (job.deactivated_at) redirect(`/sales/${id}`);

  const [locations, serviceTypes, settings] = await Promise.all([
    listActiveLocations(),
    listActiveServiceTypes(),
    getAppSettings(),
  ]);

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
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
        hstRate={Number(settings.hst_rate)}
        initial={{
          id: job.id,
          location_id: job.location_id,
          job_date: job.job_date,
          bay_no: job.bay_no?.toString() ?? "",
          upper_deck: job.upper_deck ?? "",
          lower_deck: job.lower_deck ?? "",
          invoice_no: job.invoice_no,
          customer_id: job.customer_id,
          billing_name: job.billing_name,
          license_plate: job.license_plate ?? "",
          contact_no: job.contact_no ?? "",
          email: job.email ?? "",
          odometer: job.odometer?.toString() ?? "",
          service_type_id: job.service_type_id,
          carrier_name: job.carrier_name ?? "",
          start_time: job.start_time ? toDatetimeLocal(job.start_time) : "",
          end_time: job.end_time ? toDatetimeLocal(job.end_time) : "",
          comments: job.comments ?? "",
          sub_total: job.sub_total.toString(),
          hst: job.hst.toString(),
          total: job.total.toString(),
          paid_amount: job.paid_amount.toString(),
          payment_mode: job.payment_mode ?? "",
        }}
      />
    </div>
  );
}

// <input type="datetime-local" /> wants "YYYY-MM-DDTHH:mm" with no timezone.
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
