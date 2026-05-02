"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VehicleFormDialog } from "@/components/customers/vehicle-form-dialog";

export function AddVehicleButton({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add vehicle
      </Button>
      <VehicleFormDialog
        open={open}
        onOpenChange={setOpen}
        customerId={customerId}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
