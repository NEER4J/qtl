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
import { EmptyDropdownHint } from "@/components/help/empty-state";
import { InfoTip } from "@/components/help/info-tip";
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
          overtime_hours: existing.overtime_hours,
          overtime_rate: existing.overtime_rate,
          holiday_pay: existing.holiday_pay,
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
          overtime_hours: 0,
          overtime_rate: 0,
          holiday_pay: 0,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  {employees.length === 0 && !isEdit ? (
                    <EmptyDropdownHint
                      message="No active employees yet. You need to add your staff as employee records before you can put them on payroll."
                      actionLabel="Add employees"
                      href="/payroll/employees"
                    />
                  ) : (
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
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Fieldset legend="Regular wages">
              <div className="grid grid-cols-2 gap-4">
                <NumberField name="hours" label="Hours" control={form.control} step="0.25" />
                <NumberField name="rate" label="Hourly rate ($)" control={form.control} />
              </div>
            </Fieldset>

            <Fieldset legend="Overtime">
              <div className="grid grid-cols-2 gap-4">
                <NumberField name="overtime_hours" label="OT hours" control={form.control} step="0.25" />
                <NumberField
                  name="overtime_rate"
                  label="OT rate ($)"
                  control={form.control}
                  tip="Premium rate paid for hours over the standard work week — typically 1.5× the regular rate."
                />
              </div>
            </Fieldset>

            <Fieldset legend="Extras">
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  name="holiday_pay"
                  label="Holiday pay ($)"
                  control={form.control}
                  tip="Statutory holiday pay for this pay period. Counts as insurable (subject to EI + CPP)."
                />
                <NumberField
                  name="bonus"
                  label="Bonus ($)"
                  control={form.control}
                  tip="Performance or one-time bonus. Insurable — adds to EI + CPP base."
                />
                <NumberField
                  name="misc_extra"
                  label="Misc extra ($)"
                  control={form.control}
                  tip="Other taxable extras — tool allowance, taxable reimbursements. Subject to income tax but NOT EI/CPP."
                />
                <NumberField
                  name="income_tax"
                  label="Income tax ($)"
                  control={form.control}
                  tip="Federal + provincial income tax withheld this period. Look up in CRA payroll tables or your payroll calculator."
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                EI, CPP (tier 1 + 2), employer EI, employer CPP, WSIB, and vacation pay (4% default)
                are calculated automatically on save.
              </p>
            </Fieldset>

            <Fieldset legend="Benefits">
              <div className="grid grid-cols-2 gap-4">
                <NumberField name="benefit_employee_deduction" label="Employee deduction ($)" control={form.control} />
                <NumberField name="benefit_employer_contribution" label="Employer contribution ($)" control={form.control} />
              </div>
            </Fieldset>

            <Fieldset legend="Management (cheque + cash)">
              <NumberField
                name="cheque_amount"
                label="Cheque amount ($)"
                control={form.control}
                tip="Management only: the portion paid by cheque. Daily cash is tracked separately via the Cash button. Leave 0 for regular employees."
              />
            </Fieldset>

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

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-md border p-3">
      <legend className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

interface NumberFieldProps {
  name: keyof PayrollEntryInput;
  label: string;
  control: ReturnType<typeof useForm<PayrollEntryInput>>["control"];
  step?: string;
  tip?: string;
}

function NumberField({ name, label, control, step = "0.01", tip }: NumberFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-1">
            {label}
            {tip ? <InfoTip>{tip}</InfoTip> : null}
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              step={step}
              min="0"
              {...field}
              value={field.value as number | string}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
