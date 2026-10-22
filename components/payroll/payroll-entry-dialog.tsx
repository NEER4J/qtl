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
import { Label } from "@/components/ui/label";
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
import {
  getStatutoryRatesForYear,
  listEmployees,
  createPayrollEntry,
  updatePayrollEntry,
} from "@/lib/actions/payroll";
import type { Employee, PayrollEntry, StatutoryRate } from "@/lib/db/types";
import {
  computeEntryEarnings,
  computeNetPay,
  computeStatutoryDeductions,
  inferVacationRate,
} from "@/lib/utils/payroll-math";

interface Props {
  weekId: string;
  /** The week's start date — its year picks the statutory rates for Estimate. */
  weekStart?: string;
  /** The user can't see the EI + CPP column (Settings → Users). Their amounts
   *  aren't shown here; an existing entry keeps its stored figures and a new one
   *  is calculated from the rates on save. */
  hideEmployeeDeductions?: boolean;
  /** Same for the employer-remit column (employer EI / CPP). */
  hideEmployerDeductions?: boolean;
  /** app_settings.vacation_pay_rate (fraction) — the fallback when neither the
   *  entry nor the employee has its own rate. */
  shopVacationRate: number;
  existing?: PayrollEntry & { employee_name: string; employee_payroll_type: string };
  /** Employees already on this week — left out of "Add entry"; edit theirs instead. */
  takenEmployeeIds?: readonly string[];
  children: React.ReactNode;
}

type AmountKey =
  | "ei_employee"
  | "cpp_employee"
  | "cpp_employee2"
  | "ei_employer"
  | "cpp_employer"
  | "cpp_employer2";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Fraction → the percent shown in the Vacation % box (0.04 → "4"). */
const toPct = (rate: number) => String(Math.round(rate * 10000) / 100);

/** A stored default (null = none) as the number a new entry starts from. */
const dflt = (v: number | null | undefined) => (v == null ? 0 : Number(v) || 0);

/** Form values for an entry being edited, or a blank new one. */
function entryValues(
  weekId: string,
  existing: Props["existing"],
  hideEmployeeDeductions: boolean,
  hideEmployerDeductions: boolean,
): PayrollEntryInput {
  if (existing) {
    return {
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
      phone_allowance: Number(existing.phone_allowance ?? 0),
      income_tax: existing.income_tax,
      benefit_employee_deduction: existing.benefit_employee_deduction,
      benefit_employer_contribution: existing.benefit_employer_contribution,
      cheque_amount: existing.cheque_amount,
      cheque_no: existing.cheque_no ?? "",
      pay_date: existing.pay_date ?? "",
      // The stored amounts, even when this user can't see them — so editing
      // hours never recalculates EI/CPP someone typed in.
      ei_employee: Number(existing.ei_employee) || 0,
      cpp_employee: Number(existing.cpp_employee) || 0,
      cpp_employee2: Number(existing.cpp_employee2) || 0,
      ei_employer: Number(existing.ei_employer) || 0,
      cpp_employer: Number(existing.cpp_employer) || 0,
      cpp_employer2: Number(existing.cpp_employer2) || 0,
      // `?? true` guards a row saved before migration 0135 added the
      // columns — those entries were calculated with everything applied.
      apply_ei: existing.apply_ei ?? true,
      apply_cpp: existing.apply_cpp ?? true,
      apply_cpp2: existing.apply_cpp2 ?? true,
      apply_income_tax: existing.apply_income_tax ?? true,
      apply_vacation: existing.apply_vacation ?? true,
      apply_wsib: existing.apply_wsib ?? true,
      notes: existing.notes ?? "",
    };
  }
  return {
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
    phone_allowance: 0,
    income_tax: 0,
    benefit_employee_deduction: 0,
    benefit_employer_contribution: 0,
    cheque_amount: 0,
    cheque_no: "",
    pay_date: "",
    // A hidden pair is left out, so the server calculates it from the rates.
    ei_employee: hideEmployeeDeductions ? undefined : 0,
    cpp_employee: hideEmployeeDeductions ? undefined : 0,
    cpp_employee2: hideEmployeeDeductions ? undefined : 0,
    ei_employer: hideEmployerDeductions ? undefined : 0,
    cpp_employer: hideEmployerDeductions ? undefined : 0,
    cpp_employer2: hideEmployerDeductions ? undefined : 0,
    apply_ei: true,
    apply_cpp: true,
    apply_cpp2: true,
    apply_income_tax: true,
    apply_vacation: true,
    apply_wsib: true,
    notes: "",
  };
}

export function PayrollEntryDialog({
  weekId,
  weekStart,
  hideEmployeeDeductions = false,
  hideEmployerDeductions = false,
  shopVacationRate,
  existing,
  takenEmployeeIds,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  // Statutory rates for the week's year: the employer-EI multiplier and the
  // Estimate button. Empty when none are set up (or the role can't read them).
  const [rates, setRates] = useState<StatutoryRate[]>([]);
  const router = useRouter();
  const rateYear = weekStart ? Number(weekStart.slice(0, 4)) : new Date().getFullYear();

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    getStatutoryRatesForYear(rateYear).then(setRates).catch(() => setRates([]));
  }, [open, rateYear]);

  const eiMultiplier =
    Number(rates.find((r) => r.type === "ei_employer_multiplier")?.rate) || 1.4;

  const form = useForm<PayrollEntryInput>({
    resolver: zodResolver(PayrollEntryInput),
    defaultValues: entryValues(weekId, existing, hideEmployeeDeductions, hideEmployerDeductions),
  });

  /**
   * The vacation rate this entry starts from, as a fraction: the rate it was
   * saved at → (an entry from before 0158) the rate its vacation pay works
   * back to → the employee's override → the shop rate.
   */
  function startingVacationRate(): number {
    const empRate = (id: string) => employees.find((e) => e.id === id)?.vacation_pay_rate;
    if (existing) {
      return (
        existing.vacation_rate ??
        inferVacationRate(existing) ??
        empRate(existing.employee_id) ??
        shopVacationRate
      );
    }
    return shopVacationRate;
  }

  // Vacation % is typed as a percent but saved as a fraction (like the
  // Payroll settings card), so the box keeps its own text while typing.
  const [vacationPct, setVacationPct] = useState(() => toPct(startingVacationRate()));

  // Every open starts from the row as it is NOW. Values set once at mount went
  // stale after a save + refresh, and "Add entry" reopened with the previous
  // person's numbers — saving that again overwrote them (upsert on employee).
  function onOpenChange(next: boolean) {
    if (next) {
      form.reset(entryValues(weekId, existing, hideEmployeeDeductions, hideEmployerDeductions));
      setVacationPct(toPct(startingVacationRate()));
    }
    setOpen(next);
  }

  async function onSubmit(values: PayrollEntryInput) {
    // Blank = no rate of its own: the server uses the employee's, then the shop's.
    let vacation_rate: number | null = null;
    if (vacationPct.trim() !== "") {
      const pct = Number(vacationPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        toast.error("Vacation % must be between 0 and 100.");
        return;
      }
      vacation_rate = Math.round(pct * 100) / 10000;
    }
    const result = existing
      ? await updatePayrollEntry({ ...values, vacation_rate, id: existing.id })
      : await createPayrollEntry({ ...values, vacation_rate });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(existing ? "Entry updated" : "Entry added");
    setOpen(false);
    router.refresh();
  }

  const isEdit = !!existing;
  const pickable = isEdit
    ? employees
    : employees.filter((e) => !takenEmployeeIds?.includes(e.id));
  const applyEi = form.watch("apply_ei");
  const applyCpp = form.watch("apply_cpp");
  const applyCpp2 = form.watch("apply_cpp2");
  const applyTax = form.watch("apply_income_tax");

  const applyVacation = form.watch("apply_vacation");

  // The same calculation buildEntryPayload saves with (lib/utils/payroll-math):
  // holiday pay is hours × rate (0136), its rate falling back to the regular
  // one; insurable = regular + OT + bonus + holiday + phone allowance; misc
  // extra is taxable but not insurable; vacation leaves out phone + misc.
  const num = (k: keyof PayrollEntryInput) => Number(form.watch(k)) || 0;
  const holidayHours = num("holiday_hours");
  const holidayRateInput = num("holiday_rate");
  const selectedEmployee = employees.find((e) => e.id === form.watch("employee_id"));
  // Blank falls back like the server does: the employee's rate, then the shop's.
  const vacationRateNow =
    vacationPct.trim() === ""
      ? (selectedEmployee?.vacation_pay_rate ?? shopVacationRate)
      : (Number(vacationPct) || 0) / 100;
  const pay = computeEntryEarnings(
    {
      hours: num("hours"),
      rate: num("rate"),
      overtime_hours: num("overtime_hours"),
      overtime_rate: num("overtime_rate"),
      holiday_hours: holidayHours,
      holiday_rate: holidayRateInput,
      bonus: num("bonus"),
      misc_extra: num("misc_extra"),
      phone_allowance: num("phone_allowance"),
      apply_vacation: applyVacation,
    },
    vacationRateNow,
  );
  const effectiveHolidayRate = pay.holidayRate;
  const holidayPay = pay.holidayPay;
  const insurable = pay.insurable;
  const netPreview = computeNetPay(pay.gross, {
    ei: applyEi ? num("ei_employee") : 0,
    cpp: applyCpp ? num("cpp_employee") : 0,
    cpp2: applyCpp && applyCpp2 ? num("cpp_employee2") : 0,
    incomeTax: applyTax ? num("income_tax") : 0,
    benefit: num("benefit_employee_deduction"),
  });

  /**
   * Typing an employee amount fills the employer side — EI × the employer
   * multiplier, CPP and CPP2 matched 1:1 — as long as the employer box still
   * holds what the previous employee amount would have filled in (or 0). Once
   * someone types their own employer figure, it's left alone.
   */
  const employerFor: Record<"ei_employee" | "cpp_employee" | "cpp_employee2", [AmountKey, (v: number) => number]> = {
    ei_employee: ["ei_employer", (v) => round2(v * eiMultiplier)],
    cpp_employee: ["cpp_employer", (v) => round2(v)],
    cpp_employee2: ["cpp_employer2", (v) => round2(v)],
  };
  function onEmployeeAmountChange(key: keyof typeof employerFor, raw: string) {
    const prev = Number(form.getValues(key)) || 0;
    form.setValue(key, raw as unknown as number, { shouldDirty: true });
    if (hideEmployerDeductions) return;
    const [employerKey, derive] = employerFor[key];
    const employerNow = Number(form.getValues(employerKey)) || 0;
    if (employerNow === 0 || employerNow === derive(prev)) {
      form.setValue(employerKey, derive(Number(raw) || 0), { shouldDirty: true });
    }
  }

  /** Fill all six amounts from the rate table — a starting point to check. */
  function estimateFromRates() {
    if (rates.length === 0) {
      toast.error(
        `No statutory rates for ${rateYear} — add them in Settings → Statutory rates, or type the amounts in.`,
      );
      return;
    }
    const c = computeStatutoryDeductions(insurable, rates, rateYear);
    const set = (k: AmountKey, v: number) => form.setValue(k, round2(v), { shouldDirty: true });
    if (!hideEmployeeDeductions) {
      set("ei_employee", c.ei);
      set("cpp_employee", c.cpp);
      set("cpp_employee2", c.cpp2);
    }
    if (!hideEmployerDeductions) {
      set("ei_employer", c.ei_employer);
      set("cpp_employer", c.cpp_employer);
      set("cpp_employer2", c.cpp_employer2);
    }
  }

  /**
   * Picking an employee on a NEW entry fills it from that person's record:
   * hourly rate, the pay defaults (0158, client 2026-10-20 — they used to be
   * typed every week), vacation %, and the switches (employees.apply_*). A
   * default left blank starts at 0, so switching people never carries the
   * last one's pay over. Editing never re-seeds — the entry records what
   * applied to that pay period, and changing the employee record later must
   * not silently rewrite history.
   */
  function onEmployeeChange(employeeId: string) {
    form.setValue("employee_id", employeeId, { shouldValidate: true });
    if (isEdit) return;
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const set = (k: keyof PayrollEntryInput, v: number) => form.setValue(k, v, { shouldDirty: true });
    const rate = Number(emp.default_hourly_rate) || 0;
    set("rate", rate);
    set("hours", dflt(emp.default_hours));
    set("overtime_hours", dflt(emp.default_overtime_hours));
    // Ontario overtime is time-and-a-half; a default OT-hours figure with a $0
    // OT rate would quietly pay nothing.
    set("overtime_rate", round2(rate * 1.5));
    set("bonus", dflt(emp.default_bonus));
    set("phone_allowance", dflt(emp.default_phone_allowance));
    set("misc_extra", dflt(emp.default_misc_extra));
    set("income_tax", dflt(emp.default_income_tax));
    set("benefit_employee_deduction", dflt(emp.default_benefit_employee_deduction));
    set("benefit_employer_contribution", dflt(emp.default_benefit_employer_contribution));
    setVacationPct(toPct(emp.vacation_pay_rate ?? shopVacationRate));
    form.setValue("apply_ei", emp.apply_ei ?? true);
    form.setValue("apply_cpp", emp.apply_cpp ?? true);
    form.setValue("apply_cpp2", emp.apply_cpp2 ?? true);
    form.setValue("apply_income_tax", emp.apply_income_tax ?? true);
    form.setValue("apply_vacation", emp.apply_vacation ?? true);
    form.setValue("apply_wsib", emp.apply_wsib ?? true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  ) : pickable.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Every active employee is already on this week. Use Edit on their row to change an entry.
                    </p>
                  ) : (
                    <Select value={field.value} onValueChange={onEmployeeChange} disabled={isEdit}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pickable.map((e) => (
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
                  name="phone_allowance"
                  label="Phone allowance ($)"
                  control={form.control}
                  tip="Cell phone allowance paid this period. Taxable and insurable — counts in gross, EI, CPP and WSIB, but not in vacation pay."
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
                <div className="grid gap-2">
                  <Label htmlFor="entry-vacation-pct" className="flex items-center gap-1">
                    Vacation (%)
                    <InfoTip>
                      Vacation accrued on wages + overtime + bonus + holiday pay (not the phone
                      allowance or misc extras). Starts from the employee&apos;s own rate, else the
                      shop rate. Leave blank to use those.
                    </InfoTip>
                  </Label>
                  <Input
                    id="entry-vacation-pct"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={vacationPct}
                    onChange={(e) => setVacationPct(e.target.value)}
                    placeholder={toPct(selectedEmployee?.vacation_pay_rate ?? shopVacationRate)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {applyVacation ? (
                  <>
                    Vacation accrued:{" "}
                    <strong className="text-foreground">${pay.vacationPay.toFixed(2)}</strong> at{" "}
                    {toPct(vacationRateNow)}% (shop rate {toPct(shopVacationRate)}%
                    {selectedEmployee?.vacation_pay_rate != null
                      ? `, ${selectedEmployee.full_name}'s rate ${toPct(selectedEmployee.vacation_pay_rate)}%`
                      : ""}
                    ).{" "}
                  </>
                ) : (
                  <>Vacation accrual is switched off for this entry. </>
                )}
                WSIB is calculated on save. EI and CPP are entered in <strong>EI &amp; CPP</strong>{" "}
                below.
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

            {!(hideEmployeeDeductions && hideEmployerDeductions) && (
              <Fieldset legend="EI & CPP">
                <div className="grid grid-cols-[4rem_1fr_1fr] items-end gap-x-4 gap-y-3">
                  <span />
                  <span className="text-xs font-medium text-muted-foreground">
                    {hideEmployeeDeductions ? "" : "Employee ($)"}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {hideEmployerDeductions ? "" : "Employer ($)"}
                  </span>
                  {(
                    [
                      ["EI", "ei_employee", "ei_employer", !applyEi],
                      ["CPP", "cpp_employee", "cpp_employer", !applyCpp],
                      ["CPP2", "cpp_employee2", "cpp_employer2", !(applyCpp && applyCpp2)],
                    ] as const
                  ).map(([label, employeeKey, employerKey, off]) => (
                    <AmountRow
                      key={label}
                      label={label}
                      off={off}
                      control={form.control}
                      employeeKey={hideEmployeeDeductions ? null : employeeKey}
                      employerKey={hideEmployerDeductions ? null : employerKey}
                      onEmployeeChange={(raw) => onEmployeeAmountChange(employeeKey, raw)}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground max-w-md">
                    Enter this period&apos;s amounts from your payroll calculator. The employer side
                    fills in as you type (EI × {eiMultiplier}, CPP matched) and can be changed. A
                    switched-off item is saved as $0.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={estimateFromRates}>
                    Estimate from rates
                  </Button>
                </div>
              </Fieldset>
            )}

            <Fieldset legend="Benefits">
              <div className="grid grid-cols-2 gap-4">
                <NumberField name="benefit_employee_deduction" label="Employee deduction ($)" control={form.control} />
                <NumberField name="benefit_employer_contribution" label="Employer contribution ($)" control={form.control} />
              </div>
            </Fieldset>

            <Fieldset legend="Payment">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pay_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Pay date
                        <InfoTip>
                          The date the employee is paid for this period. Prints on the pay stub
                          and the register. Leave blank until it is known.
                        </InfoTip>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cheque_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Cheque no.
                        <InfoTip>
                          The number of the cheque this pay goes out on. Leave blank when paid by
                          e-transfer, direct deposit or cash.
                        </InfoTip>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="e.g. 001245" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

            <p
              className={
                netPreview < 0
                  ? "text-sm font-medium text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              Net pay: <span className="tabular-nums">${netPreview.toFixed(2)}</span>
              {netPreview < 0 && " — the deductions are more than this period's pay."}
            </p>

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

/** One EI / CPP / CPP2 row: employee and employer amount, greyed when switched off. */
function AmountRow({
  label,
  off,
  control,
  employeeKey,
  employerKey,
  onEmployeeChange,
}: {
  label: string;
  off: boolean;
  control: ReturnType<typeof useForm<PayrollEntryInput>>["control"];
  employeeKey: AmountKey | null;
  employerKey: AmountKey | null;
  onEmployeeChange: (raw: string) => void;
}) {
  return (
    <>
      <span className={off ? "pb-2 text-sm text-muted-foreground" : "pb-2 text-sm font-medium"}>
        {label}
        {off && <span className="block text-[10px] font-normal">switched off</span>}
      </span>
      {employeeKey ? (
        <FormField
          control={control}
          name={employeeKey}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={off}
                  aria-label={`${label} employee`}
                  {...field}
                  value={off ? 0 : ((field.value as number | string | undefined) ?? "")}
                  onChange={(e) => onEmployeeChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <span />
      )}
      {employerKey ? (
        <FormField
          control={control}
          name={employerKey}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={off}
                  aria-label={`${label} employer`}
                  {...field}
                  value={off ? 0 : ((field.value as number | string | undefined) ?? "")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <span />
      )}
    </>
  );
}
