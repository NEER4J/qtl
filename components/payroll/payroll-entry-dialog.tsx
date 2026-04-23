"use client";

import { useEffect, useState } from "react";
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
import { PayrollEntryInput } from "@/lib/schemas/payroll";
import { upsertPayrollEntry, listEmployees } from "@/lib/actions/payroll";
import type { Employee, PayrollEntry } from "@/lib/db/types";

interface Props {
  weekId: string;
  existing?: PayrollEntry & { employee_name: string; employee_payroll_type: string };
  children: React.ReactNode;
}

export function PayrollEntryDialog({ weekId, existing, children }: Props) {
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const router = useRouter();

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {});
  }, []);

  const form = useForm<PayrollEntryInput>({
    resolver: zodResolver(PayrollEntryInput),
    defaultValues: existing
      ? {
          payroll_week_id: weekId,
          employee_id: existing.employee_id,
          hours: existing.hours,
          rate: existing.rate,
          bonus: existing.bonus,
          misc_extra: existing.misc_extra,
          income_tax: existing.income_tax,
          benefit_employee_deduction: existing.benefit_employee_deduction,
          benefit_employer_contribution: existing.benefit_employer_contribution,
          cheque_amount: existing.cheque_amount,
          notes: existing.notes ?? "",
        }
      : {
          payroll_week_id: weekId,
          employee_id: "",
          hours: 0,
          rate: 0,
          bonus: 0,
          misc_extra: 0,
          income_tax: 0,
          benefit_employee_deduction: 0,
          benefit_employer_contribution: 0,
          cheque_amount: 0,
          notes: "",
        },
  });

  async function onSubmit(values: PayrollEntryInput) {
    const result = await upsertPayrollEntry(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(existing ? "Entry updated" : "Entry added");
    setOpen(false);
    router.refresh();
  }

  const isEdit = !!existing;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit entry" : "Add payroll entry"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
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
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours</FormLabel>
                    <FormControl><Input type="number" step="0.25" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly rate ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bonus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bonus ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="misc_extra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Misc extra ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="income_tax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Income tax ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cheque_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cheque amount ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="benefit_employee_deduction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Benefit deduction ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="benefit_employer_contribution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employer contribution ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
