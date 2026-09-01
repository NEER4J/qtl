"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { lockOilPrices, unlockOilPrices } from "@/lib/actions/pricing";
import type { OilPriceLockInfo } from "@/lib/actions/pricing";
import { daysFromTodayISO, todayISO } from "@/lib/utils/tz";

function defaultLockDate(): string {
  return daysFromTodayISO(30);
}

function todayStr(): string {
  return todayISO();
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  return Math.max(0, Math.round((d.getTime() - today.getTime()) / 86_400_000));
}

/**
 * Lock / unlock the selling prices on one oil-detail page (oil type +
 * container). Mirrors the part-package price lock: snapshot now, charge the
 * snapshot until the lock date, ignore catalogue drift in between.
 */
export function OilPriceLockControls({
  oilTypeId,
  container,
  lock,
  engineCount,
}: {
  oilTypeId: string;
  container: "bulk" | "gallon";
  lock: OilPriceLockInfo | null;
  engineCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lockUntil, setLockUntil] = useState(defaultLockDate());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLockUntil(lock?.is_live ? lock.lock_until : defaultLockDate());
    setError(null);
  }, [open, lock]);

  const isLocked = !!lock?.is_live;

  const onLock = () => {
    setError(null);
    startTransition(async () => {
      const res = await lockOilPrices({
        oil_type_id: oilTypeId,
        container,
        lock_until: lockUntil,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Locked ${res.data.item_count} price${res.data.item_count === 1 ? "" : "s"}`);
      setOpen(false);
      router.refresh();
    });
  };

  const onUnlock = () => {
    startTransition(async () => {
      const res = await unlockOilPrices({ oil_type_id: oilTypeId, container });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prices unlocked");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      {isLocked && (
        <Badge variant="outline" className="gap-1">
          <Lock className="size-3" />
          Locked · {daysUntil(lock!.lock_until)}d
        </Badge>
      )}
      {isLocked ? (
        <>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
            <Lock className="size-4" /> Re-lock…
          </Button>
          <Button variant="ghost" size="sm" onClick={onUnlock} disabled={isPending}>
            <Unlock className="size-4" /> Unlock
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
          <Lock className="size-4" /> Lock prices…
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lock {container} prices</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Snapshots today&apos;s selling price for all {engineCount} engines on this
              page. Until the lock date, jobs and the price grid use the snapshot even
              if filter costs, oil costs, labour or tier premiums change.
            </p>
            <div className="space-y-1">
              <Label htmlFor="oil-lock-until">Lock until</Label>
              <Input
                id="oil-lock-until"
                type="date"
                min={todayStr()}
                value={lockUntil}
                onChange={(e) => setLockUntil(e.target.value)}
              />
            </div>
            {isLocked && (
              <p className="text-xs text-muted-foreground">
                Re-locking replaces the existing snapshot with today&apos;s prices.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onLock} disabled={isPending || !lockUntil}>
              {isPending ? "Locking…" : "Lock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
