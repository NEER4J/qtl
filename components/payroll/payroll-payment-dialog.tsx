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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayrollPaymentInput } from "@/lib/schemas/payroll";
import { addPayrollPayment } from "@/lib/actions/payroll";
import { todayISO } from "@/lib/utils/format";

const PAYMENT_MODES = [
  { value: "cheque", label: "Cheque" },
  { value: "etransfer", label: "E-Transfer" },
  { value: "cash", label: "Cash" },
  { value: "debit", label: "Debit" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
];

interface Props {
  weekId: string;
  employees: { id: string; name: string }[];
  children: React.ReactNode;
}

export function PayrollPaymentDialog({ weekId, employees, children }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const form = useForm<PayrollPaymentInput>({
    resolver: zodResolver(PayrollPaymentInput),
    defaultValues: {
      payroll_week_id: weekId,
      employee_id: "",
      paid_on: todayISO(),
      amount: 0,
      mode: "cheque",
      transaction_id: "",
      notes: "",
    },
  });

  async function onSubmit(values: PayrollPaymentInput) {
    const result = await addPayrollPayment(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Payment recorded");
    setOpen(false);
    form.reset({ payroll_week_id: weekId, employee_id: "", paid_on: todayISO(), amount: 0, mode: "cheque", transaction_id: "", notes: "" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payroll payment</DialogTitle>
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
                      {PAYMENT_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
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
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="Auto-generated if blank" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Record"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
