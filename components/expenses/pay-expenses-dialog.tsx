"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { payExpenses } from "@/lib/actions/expenses";
import type { PaymentMode } from "@/lib/db/types";
import { formatMoney, todayISO } from "@/lib/utils/format";

import { PAYMENT_MODES } from "./add-expense-payment-dialog";

/**
 * Clears every selected expense in one go: each gets a payment for its full
 * balance, all with the date, mode and reference entered here. For a part
 * payment, open the expense and use Record payment instead.
 */
export function PayExpensesDialog({
  open,
  onOpenChange,
  expenses,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The selected expenses that still owe something. */
  expenses: { id: string; label: string; balance: number }[];
  onPaid: () => void;
}) {
  const [paidOn, setPaidOn] = useState(todayISO());
  const [mode, setMode] = useState<PaymentMode>("cheque");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const total = expenses.reduce((s, e) => s + e.balance, 0);

  const submit = () => {
    if (!paidOn) {
      toast.error("Pick the payment date.");
      return;
    }
    startTransition(async () => {
      const res = await payExpenses({
        expense_ids: expenses.map((e) => e.id),
        paid_on: paidOn,
        mode,
        transaction_id: reference || null,
        notes: notes || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { paid, skipped, amount } = res.data;
      toast.success(
        `${paid} expense${paid === 1 ? "" : "s"} marked paid — ${formatMoney(amount)}` +
          (skipped > 0 ? `. ${skipped} skipped (already paid or not yours to pay).` : ""),
      );
      setReference("");
      setNotes("");
      onOpenChange(false);
      onPaid();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Mark {expenses.length} expense{expenses.length === 1 ? "" : "s"} as paid
          </DialogTitle>
          <DialogDescription>
            Each one gets a payment for its full balance, with the details below —{" "}
            <strong className="text-foreground">{formatMoney(total)}</strong> in all.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-40 overflow-auto rounded-md border text-sm">
          {expenses.map((e) => (
            <div key={e.id} className="flex justify-between gap-4 border-b px-3 py-1.5 last:border-b-0">
              <span className="truncate">{e.label}</span>
              <span className="tabular-nums">{formatMoney(e.balance)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pay-expenses-date">Payment date</Label>
              <Input
                id="pay-expenses-date"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-expenses-mode">Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger id="pay-expenses-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-expenses-ref">
              {mode === "cheque" ? "Cheque no." : "Transaction ID"}
            </Label>
            <Input
              id="pay-expenses-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Same on every payment — auto-generated if blank"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-expenses-notes">Notes</Label>
            <Textarea
              id="pay-expenses-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isPending || expenses.length === 0}>
            {isPending ? "Saving…" : `Mark paid — ${formatMoney(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
