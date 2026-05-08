"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lockPartPackage } from "@/lib/actions/pricing";
import type { PartPackageWithItems } from "@/lib/db/types";

function defaultLockDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LockPackageDialog({
  open,
  onOpenChange,
  pkg,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg?: PartPackageWithItems;
}) {
  const [isPending, startTransition] = useTransition();
  const [lockUntil, setLockUntil] = useState<string>(defaultLockDate());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLockUntil(defaultLockDate());
    setError(null);
  }, [open]);

  if (!pkg) return null;

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await lockPartPackage({ id: pkg.id, lock_until: lockUntil });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Package locked");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lock package prices</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Snapshots the current price of every part and the labor selling
            price. Until the lock date, this package will use the snapshotted
            prices on jobs even if the catalog changes.
          </p>
          <div className="space-y-1">
            <Label htmlFor="lock-until">Lock until</Label>
            <Input
              id="lock-until"
              type="date"
              min={todayStr()}
              value={lockUntil}
              onChange={(e) => setLockUntil(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isPending || !lockUntil}>
            {isPending ? "Locking…" : "Lock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
