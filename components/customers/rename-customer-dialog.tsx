"use client";

import { useEffect, useState } from "react";

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
import { fetchCustomerCreditBalance } from "@/lib/actions/customer-credits";
import type { Vehicle } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

/**
 * Confirms a customer name change. A rename starts a new customer record
 * linked to the old one (0155): old invoices and history keep the old name,
 * and staff choose which vehicles — and whether the store credit — move over.
 */
export function RenameCustomerDialog({
  open,
  onOpenChange,
  customerId,
  oldName,
  newName,
  vehicles,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  oldName: string;
  newName: string;
  vehicles: Vehicle[];
  pending: boolean;
  onConfirm: (vehicleIds: string[], moveCredit: boolean) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [credit, setCredit] = useState(0);
  const [moveCredit, setMoveCredit] = useState(true);

  // Every vehicle moves by default — a rename is usually the same fleet.
  useEffect(() => {
    if (!open) return;
    setPicked(new Set(vehicles.map((v) => v.id)));
    setMoveCredit(true);
    let cancelled = false;
    fetchCustomerCreditBalance(customerId)
      .then((b) => !cancelled && setCredit(b))
      .catch(() => !cancelled && setCredit(0));
    return () => {
      cancelled = true;
    };
  }, [open, vehicles, customerId]);

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rename customer</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{oldName}</strong> becomes{" "}
            <strong className="text-foreground">{newName}</strong>. A new customer record is
            created for the new name and linked to this one. Past invoices, sales and history
            stay under {oldName}; new jobs use {newName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">Move vehicles to {newName}</span>
              {vehicles.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={() =>
                    setPicked(
                      picked.size === vehicles.length ? new Set() : new Set(vehicles.map((v) => v.id)),
                    )
                  }
                >
                  {picked.size === vehicles.length ? "Select none" : "Select all"}
                </button>
              )}
            </div>
            {vehicles.length === 0 ? (
              <p className="text-muted-foreground">This customer has no vehicles.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-auto rounded-md border p-2">
                {vehicles.map((v) => (
                  <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted/50">
                    <Checkbox
                      checked={picked.has(v.id)}
                      onCheckedChange={(c) => toggle(v.id, c === true)}
                    />
                    <span className="font-mono">{v.license_plate}</span>
                    <span className="truncate text-muted-foreground">
                      {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Vehicles left behind can be moved later from {oldName}&apos;s page.
            </p>
          </div>

          {credit > 0 && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3">
              <Checkbox
                checked={moveCredit}
                onCheckedChange={(c) => setMoveCredit(c === true)}
                className="mt-0.5"
              />
              <span>
                Move the store credit of <strong>{formatMoney(credit)}</strong> to {newName}
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => onConfirm([...picked], credit > 0 && moveCredit)}
          >
            {pending ? "Renaming…" : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
