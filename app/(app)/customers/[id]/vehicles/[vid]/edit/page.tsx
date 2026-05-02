import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer } from "@/lib/actions/customers";
import { getVehicle } from "@/lib/actions/vehicles";
import { VehicleForm } from "../../vehicle-form";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string; vid: string }>;
}) {
  const { id, vid } = await params;
  const [customer, vehicle] = await Promise.all([getCustomer(id), getVehicle(vid)]);
  if (!customer || !vehicle || vehicle.customer_id !== id) notFound();

  const displayName =
    customer.billing_name ??
    [customer.first_name, customer.last_or_company].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={`/customers/${id}`}>
            <ChevronLeft className="size-4" /> Back to {displayName}
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit vehicle <span className="font-mono text-base">{vehicle.license_plate}</span>
        </h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Vehicle details</CardTitle></CardHeader>
        <CardContent>
          <VehicleForm customerId={id} vehicle={vehicle} />
        </CardContent>
      </Card>
    </div>
  );
}
