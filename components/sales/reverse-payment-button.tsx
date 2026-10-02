"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
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
import { reverseSalesPayment } from "@/lib/actions/sales";

/**
 * Confirm-then-reverse for one payment on an invoice (bounced cheque, payment
 * posted to the wrong invoice). The invoice's paid amount and status are
 * recalculated by the database once the payment is gone.
 */
export function ReversePaymentButton({
  paymentId,
  label,
}: {
  paymentId: string;
  /** e.g. "$1,234.56 cheque · TXN-006190" — shown in the confirmation. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await reverseSalesPayment({ id: paymentId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Payment reversed");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
          <Undo2 className="size-3.5" /> Reverse
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reverse this payment?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} will be removed from this invoice and the balance goes back
            to outstanding. Any store credit this payment created is taken back.
            The reversal is kept in the audit log.
          </AlertDialogDescription>
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
            {pending ? "Reversing…" : "Reverse payment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
