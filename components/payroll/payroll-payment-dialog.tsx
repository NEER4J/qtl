"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayrollPaymentInput } from "@/lib/schemas/payroll";
import { addPayrollPayment, updatePayrollPayment } from "@/lib/actions/payroll";
import { todayISO } from "@/lib/utils/format";
import { PAYMENT_MODE_LABELS } from "@/lib/utils/payment-modes";
import type { PaymentMode, PayrollPayment } from "@/lib/db/types";

// Every way money can go out to an employee. "oc" (on account) is a sales
// tender with no meaning for wages, so it is only offered back on a payment
// that already has it.
const PAYROLL_MODES: PaymentMode[] = [
  "cheque",
  "etransfer",
  "cash",
  "debit",
  "visa",
  "mastercard",
  "credit_card",
];

interface Props {
  weekId: string;
  employees: { id: string; name: string }[];
  /** Pass a payment to edit it; omit to record a new one. */
  existing?: PayrollPayment;
  children: React.ReactNode;
}

export function PayrollPaymentDialog({ weekId, employees, existing, children }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!existing;

  const blank: PayrollPaymentInput = {
    payroll_week_id: weekId,
    employee_id: "",
    paid_on: todayISO(),
    amount: 0,
    mode: "cheque",
    transaction_id: "",
    notes: "",
  };

  const valuesFor = (): PayrollPaymentInput =>
    existing
      ? {
          payroll_week_id: weekId,
          employee_id: existing.employee_id,
          paid_on: existing.paid_on,
          amount: existing.amount,
          mode: existing.mode,
          transaction_id: existing.transaction_id ?? "",
          notes: existing.notes ?? "",
        }
      : blank;

  const form = useForm<PayrollPaymentInput>({
    resolver: zodResolver(PayrollPaymentInput),
    defaultValues: valuesFor(),
  });

  // Every open starts from the payment as it is NOW (client 2026-10-20 —
  // values set once at mount reopened stale after a save + refresh).
  function onOpenChange(next: boolean) {
    if (next) form.reset(valuesFor());
    setOpen(next);
  }

  const modes =
    existing && !PAYROLL_MODES.includes(existing.mode) ? [...PAYROLL_MODES, existing.mode] : PAYROLL_MODES;

  async function onSubmit(values: PayrollPaymentInput) {
    const result = existing
      ? await updatePayrollPayment({ ...values, id: existing.id })
      : await addPayrollPayment(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Payment updated" : "Payment recorded");
    setOpen(false);
    if (!isEdit) form.reset(blank);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit payroll payment" : "Record payroll payment"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paid_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment mode</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {modes.map((m) => (
                        <SelectItem key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="transaction_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference / transaction ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder={
                        existing?.transaction_id
                          ? `Blank keeps ${existing.transaction_id}`
                          : "Auto-generated if blank"
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      {...field}
                      value={field.value ?? ""}
                      placeholder="e.g. part payment, advance, bank memo"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save" : "Record"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
