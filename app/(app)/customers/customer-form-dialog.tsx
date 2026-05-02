"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomerVehicles } from "@/lib/actions/vehicles";
import type { Customer, Location, Vehicle } from "@/lib/db/types";

export function CustomerFormDialog({
  open,
  onOpenChange,
  mode,
  customer,
  locations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  customer?: Customer;
  locations: Location[];
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      getCustomerVehicles(customer.id).then(setVehicles);
    } else {
      setVehicles([]);
    }
  }, [open, customer]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[96vw] max-w-[1400px] overflow-y-auto sm:!max-w-[1400px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New customer" : "Edit customer"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new customer. You can manage vehicles after saving."
              : "Update customer details. Vehicles are managed in the Vehicles tab."}
          </DialogDescription>
        </DialogHeader>
        <CustomerForm
          customer={customer}
          initialVehicles={vehicles}
          locations={locations}
          onSaved={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
