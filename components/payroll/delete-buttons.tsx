"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  deletePayrollEntry,
  deletePayrollPayment,
  deletePayrollWeek,
} from "@/lib/actions/payroll";
/** Minimal shape of the wrapAction result — declared here rather than imported
 *  from lib/actions/_utils, which is `server-only`. */
type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Shared confirm-then-delete shell. Payroll rows are money records, so nothing
 * disappears on a single stray click — every delete goes through this.
 */
function ConfirmDelete({
  title,
  description,
  confirmLabel,
  successMessage,
  trigger,
  run,
  onDone,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  successMessage: string;
  trigger: React.ReactNode;
  run: () => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
      if (onDone) onDone();
      else router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {pending ? "Removing…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteEntryButton({
  entryId,
  employeeName,
}: {
  entryId: string;
  employeeName: string;
}) {
  return (
    <ConfirmDelete
      title={`Remove ${employeeName} from this week?`}
      description="Their hours, deductions, and any daily cash logged against this entry are deleted. Payments already recorded for them stay on the week — remove those separately if they were never paid."
      confirmLabel="Remove entry"
      successMessage="Entry removed"
      run={() => deletePayrollEntry({ id: entryId })}
      trigger={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive">
          Delete
        </Button>
      }
    />
  );
}

export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  return (
    <ConfirmDelete
      title="Delete this payment?"
      description="The disbursement record is removed from the week's paper trail. Do this only if the payment never actually went out."
      confirmLabel="Delete payment"
      successMessage="Payment deleted"
      run={() => deletePayrollPayment({ id: paymentId })}
      trigger={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive">
          <Trash2 className="size-3.5" />
        </Button>
      }
    />
  );
}

export function DeleteWeekButton({
  weekId,
  entryCount,
  paymentCount,
}: {
  weekId: string;
  entryCount: number;
  paymentCount: number;
}) {
  const router = useRouter();
  const counts =
    entryCount === 0 && paymentCount === 0
      ? "This week has no entries or payments on it."
      : `This deletes ${entryCount} entr${entryCount === 1 ? "y" : "ies"} and ${paymentCount} payment${paymentCount === 1 ? "" : "s"} along with it.`;

  return (
    <ConfirmDelete
      title="Delete this pay week?"
      description={`${counts} There is no undo — if you only need to change the dates or the shop, use Edit week instead.`}
      confirmLabel="Delete week"
      successMessage="Pay week deleted"
      run={() => deletePayrollWeek({ id: weekId })}
      onDone={() => router.push("/payroll")}
      trigger={
        <Button variant="outline" size="sm" className="text-destructive">
          <Trash2 className="size-4" /> Delete week
        </Button>
      }
    />
  );
}
