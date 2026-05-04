import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer } from "@/lib/actions/customers";
import { VehicleForm } from "../vehicle-form";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const displayName = customer.billing_name ?? customer.last_or_company ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={`/customers/${id}`}>
            <ChevronLeft className="size-4" /> Back to {displayName}
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add vehicle</h1>
        <p className="text-sm text-muted-foreground">
          For <span className="font-medium">{displayName}</span>. License plate and VIN must be unique
          across the company.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Vehicle details</CardTitle></CardHeader>
        <CardContent>
          <VehicleForm customerId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
