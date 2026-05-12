"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/help/info-tip";
import { updatePricingSettings } from "@/lib/actions/pricing";

interface Props {
  initial: {
    counter_premium: number;
    customer_supplies_labour: number;
    vacation_pay_rate: number;
    wsib_rate: number;
    price_list_effective_date: string | null;
  };
}

export function PricingSettingsCard({ initial }: Props) {
  const [counter, setCounter] = useState(String(initial.counter_premium));
  const [supplies, setSupplies] = useState(String(initial.customer_supplies_labour));
  // Rates stored as fractions (0.04 = 4%); display as percent for clarity.
  const [vacationPct, setVacationPct] = useState(
    String(Math.round(initial.vacation_pay_rate * 1000) / 10),
  );
  const [wsibPct, setWsibPct] = useState(
    String(Math.round(initial.wsib_rate * 1000) / 10),
  );
  const [effective, setEffective] = useState(initial.price_list_effective_date ?? "");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const counterNum = Number(counter);
    const suppliesNum = Number(supplies);
    const vacationNum = Number(vacationPct);
    const wsibNum = Number(wsibPct);
    if (
      [counterNum, suppliesNum, vacationNum, wsibNum].some(
        (n) => !Number.isFinite(n) || n < 0,
      )
    ) {
      toast.error("All numbers must be ≥ 0");
      return;
    }
    if (vacationNum > 100 || wsibNum > 100) {
      toast.error("Rates can't be over 100%");
      return;
    }
    startTransition(async () => {
      const res = await updatePricingSettings({
        counter_premium: counterNum,
        customer_supplies_labour: suppliesNum,
        vacation_pay_rate: vacationNum / 100,
        wsib_rate: wsibNum / 100,
        price_list_effective_date: effective || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Pricing settings saved");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pricing & payroll defaults</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          These constants feed the All-Filter-Price page, Print List, and payroll calculations.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Counter premium ($)"
            value={counter}
            onChange={setCounter}
            tip="Added to With-Service filter price to produce the Without-Service / Over-Counter price."
          />
          <Field
            label="Customer-supplies labour ($)"
            value={supplies}
            onChange={setSupplies}
            tip="Flat labour fee when the customer brings their own filter."
          />
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
          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              Price list effective date
              <InfoTip>
                Prints on the Print List header and shows on the All-Filter-Price page. Update
                whenever you publish new prices.
              </InfoTip>
            </label>
            <Input
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
              className="mt-1"
            />
          </div>
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
