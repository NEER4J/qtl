"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { moveCustomerVehicles } from "@/lib/actions/customers";
import type { Vehicle } from "@/lib/db/types";

/** Moves vehicles still on a renamed customer's old record to the new one. */
export function MoveVehiclesButton({
  fromCustomerId,
  toCustomerId,
  toName,
  vehicles,
}: {
  fromCustomerId: string;
  toCustomerId: string;
  toName: string;
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const openDialog = () => {
    setPicked(new Set(vehicles.map((v) => v.id)));
    setOpen(true);
  };

  const submit = () =>
    startTransition(async () => {
      const res = await moveCustomerVehicles({
        from_customer_id: fromCustomerId,
        to_customer_id: toCustomerId,
        vehicle_ids: [...picked],
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data.moved} vehicle${res.data.moved === 1 ? "" : "s"} moved to ${toName}`);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={openDialog}>
        <Truck className="size-4" /> Move vehicles to {toName}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move vehicles</DialogTitle>
            <DialogDescription>
              The picked vehicles move to {toName}. Their past jobs stay on this record.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-56 space-y-1 overflow-auto rounded-md border p-2 text-sm">
            {vehicles.map((v) => (
              <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted/50">
                <Checkbox
                  checked={picked.has(v.id)}
                  onCheckedChange={(c) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (c === true) next.add(v.id);
                      else next.delete(v.id);
                      return next;
                    })
                  }
                />
                <span className="font-mono">{v.license_plate}</span>
                <span className="truncate text-muted-foreground">
                  {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={isPending || picked.size === 0}>
              {isPending ? "Moving…" : `Move ${picked.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
