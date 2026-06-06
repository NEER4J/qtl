"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/help/info-tip";
import { updatePayrollSettings } from "@/lib/actions/payroll";

interface Props {
  initial: {
    vacation_pay_rate: number;
    wsib_rate: number;
  };
}

export function PayrollSettingsCard({ initial }: Props) {
  // Rates stored as fractions (0.04 = 4%); display as percent for clarity.
  const [vacationPct, setVacationPct] = useState(
    String(Math.round(initial.vacation_pay_rate * 1000) / 10),
  );
  const [wsibPct, setWsibPct] = useState(
    String(Math.round(initial.wsib_rate * 1000) / 10),
  );
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const vacationNum = Number(vacationPct);
    const wsibNum = Number(wsibPct);
    if ([vacationNum, wsibNum].some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error("Rates must be ≥ 0");
      return;
    }
    if (vacationNum > 100 || wsibNum > 100) {
      toast.error("Rates can't be over 100%");
      return;
    }
    startTransition(async () => {
      const res = await updatePayrollSettings({
        vacation_pay_rate: vacationNum / 100,
        wsib_rate: wsibNum / 100,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Payroll settings saved");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payroll settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Rates applied when calculating each payroll entry. Changes affect new and recalculated
          entries; already-saved entries keep their stored amounts.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-xl">
          <Field
            label="Vacation pay rate (%)"
            value={vacationPct}
            onChange={setVacationPct}
            step="0.1"
            tip="Accrued as a percentage of gross + holiday + bonus. Canadian standard is 4% (10 days/year)."
          />
          <Field
            label="WSIB rate (%)"
            value={wsibPct}
            onChange={setWsibPct}
            step="0.01"
            tip="Ontario WSIB premium rate applied against insurable earnings. Set to 0 if not Ontario."
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  tip?: string;
}

function Field({ label, value, onChange, step = "0.01", tip }: FieldProps) {
  return (
    <div>
      <label className="text-sm font-medium flex items-center gap-1">
        {label}
        {tip ? <InfoTip>{tip}</InfoTip> : null}
      </label>
      <Input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}
