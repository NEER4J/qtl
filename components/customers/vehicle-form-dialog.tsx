"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Vehicle } from "@/lib/db/types";
import {
  VehicleForm,
  type StagedVehicleInput,
} from "@/app/(app)/customers/[id]/vehicles/vehicle-form";

type Common = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Vehicle;
};

// Discriminated by which save path the caller wants:
//   - live mode: customerId + onSaved (writes to DB)
//   - staged mode: onStaged + (optional) initialStaged (no DB write)
type Live = Common & {
  customerId: string;
  onSaved?: (vehicle: Vehicle) => void;
  onStaged?: never;
  initialStaged?: never;
};
type Staged = Common & {
  customerId?: string;
  onStaged: (values: StagedVehicleInput) => void;
  initialStaged?: StagedVehicleInput;
  onSaved?: never;
};

export function VehicleFormDialog(props: Live | Staged) {
  const { open, onOpenChange, vehicle } = props;
  const titleSuffix = vehicle ? "Edit vehicle" : "Add vehicle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[96vw] max-w-[1200px] overflow-y-auto sm:!max-w-[1200px]">
        <DialogHeader>
          <DialogTitle>{titleSuffix}</DialogTitle>
          <DialogDescription>
            {vehicle
              ? `Editing ${vehicle.license_plate}.`
              : "License plate and VIN must be unique across the company."}
          </DialogDescription>
        </DialogHeader>
        {"onStaged" in props && props.onStaged ? (
          <VehicleForm
            vehicle={vehicle}
            initialStaged={props.initialStaged}
            onStaged={(v) => {
              props.onStaged(v);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <VehicleForm
            customerId={props.customerId}
            vehicle={vehicle}
            onSaved={(v) => {
              props.onSaved?.(v);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
