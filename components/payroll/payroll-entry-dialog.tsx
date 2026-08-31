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
import { Switch } from "@/components/ui/switch";
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
          holiday_hours: existing.holiday_hours ?? 0,
          holiday_rate: existing.holiday_rate ?? 0,
          bonus: existing.bonus,
          misc_extra: existing.misc_extra,
          income_tax: existing.income_tax,
          benefit_employee_deduction: existing.benefit_employee_deduction,
          benefit_employer_contribution: existing.benefit_employer_contribution,
          cheque_amount: existing.cheque_amount,
          // `?? true` guards a row saved before migration 0135 added the
          // columns — those entries were calculated with everything applied.
          apply_ei: existing.apply_ei ?? true,
          apply_cpp: existing.apply_cpp ?? true,
          apply_cpp2: existing.apply_cpp2 ?? true,
          apply_income_tax: existing.apply_income_tax ?? true,
          apply_vacation: existing.apply_vacation ?? true,
          apply_wsib: existing.apply_wsib ?? true,
          notes: existing.notes ?? "",
        }
      : {
          payroll_week_id: weekId,
          employee_id: "",
          hours: 0,
          rate: 0,
          overtime_hours: 0,
          overtime_rate: 0,
          holiday_hours: 0,
          holiday_rate: 0,
          bonus: 0,
          misc_extra: 0,
          income_tax: 0,
          benefit_employee_deduction: 0,
          benefit_employer_contribution: 0,
          cheque_amount: 0,
          apply_ei: true,
          apply_cpp: true,
          apply_cpp2: true,
          apply_income_tax: true,
          apply_vacation: true,
          apply_wsib: true,
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
  const applyCpp = form.watch("apply_cpp");
  const applyTax = form.watch("apply_income_tax");

  // Holiday pay is hours × rate now (0136). The rate field is optional: left at
  // 0 it falls back to the regular hourly rate, both here and on the server.
  const holidayHours = Number(form.watch("holiday_hours")) || 0;
  const holidayRateInput = Number(form.watch("holiday_rate")) || 0;
  const regularRate = Number(form.watch("rate")) || 0;
  const effectiveHolidayRate = holidayRateInput > 0 ? holidayRateInput : regularRate;
  const holidayPay = Math.round(holidayHours * effectiveHolidayRate * 100) / 100;

  /**
   * Picking an employee on a NEW entry seeds the switches from that person's
   * payroll defaults (employees.apply_*). Editing never re-seeds — the entry
   * records what applied to that pay period, and changing the employee record
   * later must not silently rewrite history.
   */
  function onEmployeeChange(employeeId: string) {
    form.setValue("employee_id", employeeId, { shouldValidate: true });
    if (isEdit) return;
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    form.setValue("apply_ei", emp.apply_ei ?? true);
    form.setValue("apply_cpp", emp.apply_cpp ?? true);
    form.setValue("apply_cpp2", emp.apply_cpp2 ?? true);
    form.setValue("apply_income_tax", emp.apply_income_tax ?? true);
    form.setValue("apply_vacation", emp.apply_vacation ?? true);
    form.setValue("apply_wsib", emp.apply_wsib ?? true);
  }

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
                    <Select value={field.value} onValueChange={onEmployeeChange} disabled={isEdit}>
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

            <Fieldset legend="Statutory holiday">
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  name="holiday_hours"
                  label="Holiday hours"
                  control={form.control}
                  step="0.25"
                  tip="Stat holiday hours paid this period. The dollar amount is worked out from these hours and the rate beside them."
                />
                <NumberField
                  name="holiday_rate"
                  label="Holiday rate ($)"
                  control={form.control}
                  tip="Leave at 0 to use the regular hourly rate. Set it when stat pay is an averaged rate rather than the current rate."
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {holidayHours > 0 ? (
                  <>
                    Holiday pay:{" "}
                    <strong className="text-foreground">
                      ${holidayPay.toFixed(2)}
                    </strong>{" "}
                    — {holidayHours} hrs × ${effectiveHolidayRate.toFixed(2)}
                    {holidayRateInput > 0 ? "" : " (regular rate)"}. Counts as insurable, so it
                    adds to EI, CPP, and the vacation accrual base.
                  </>
                ) : (
                  <>Enter hours (and a rate, if it differs from the regular one) — the amount is calculated for you.</>
                )}
              </p>
            </Fieldset>

            <Fieldset legend="Extras">
              <div className="grid grid-cols-2 gap-4">
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
                  disabled={!applyTax}
                  tip="Federal + provincial income tax withheld this period. Look up in CRA payroll tables or your payroll calculator."
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                EI, CPP (tier 1 + 2), employer EI, employer CPP, WSIB, and vacation pay (4% default)
                are calculated automatically on save — for whichever of them is switched on below.
              </p>
            </Fieldset>

            <Fieldset legend="What applies this period">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <SwitchField
                  name="apply_ei"
                  label="EI"
                  control={form.control}
                  hint="Off for non-arm's-length staff (family). Drops employer EI too."
                />
                <SwitchField
                  name="apply_cpp"
                  label="CPP"
                  control={form.control}
                  hint="Off for under 18, over 70, or a filed CPT30. Drops employer CPP."
                />
                <SwitchField
                  name="apply_cpp2"
                  label="CPP2"
                  control={form.control}
                  disabled={!applyCpp}
                  hint={
                    applyCpp
                      ? "Second-tier CPP on earnings above the YMPE."
                      : "CPP is off, so CPP2 does not apply."
                  }
                />
                <SwitchField
                  name="apply_income_tax"
                  label="Income tax"
                  control={form.control}
                  hint="Off stores $0 tax for this entry, whatever is typed above."
                />
                <SwitchField
                  name="apply_vacation"
                  label="Vacation accrual"
                  control={form.control}
                  hint="Off when vacation is paid out on the cheque instead of banked."
                />
                <SwitchField
                  name="apply_wsib"
                  label="WSIB"
                  control={form.control}
                  hint="Employer premium. Off for a worker outside the shop's WSIB coverage."
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These start from the employee&apos;s payroll defaults (Payroll → Employees) and
                apply to <strong>this pay period only</strong>, so a one-off cheque with no
                deductions never has to be fixed on the employee record.
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
  disabled?: boolean;
}

function NumberField({ name, label, control, step = "0.01", tip, disabled }: NumberFieldProps) {
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
              disabled={disabled}
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

/** Boolean toggle for one of the apply_* flags. */
function SwitchField({
  name,
  label,
  control,
  hint,
  disabled,
}: {
  name: "apply_ei" | "apply_cpp" | "apply_cpp2" | "apply_income_tax" | "apply_vacation" | "apply_wsib";
  label: string;
  control: ReturnType<typeof useForm<PayrollEntryInput>>["control"];
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-start justify-between gap-3 py-1.5">
          <div className="space-y-0.5">
            <FormLabel className={disabled ? "text-muted-foreground" : undefined}>{label}</FormLabel>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <FormControl>
            <Switch
              checked={!!field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
              aria-label={label}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
