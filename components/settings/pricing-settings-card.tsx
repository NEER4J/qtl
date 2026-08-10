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
    dump_truck_surcharge: number;
    price_list_effective_date: string | null;
  };
}

export function PricingSettingsCard({ initial }: Props) {
  const [counter, setCounter] = useState(String(initial.counter_premium));
  const [supplies, setSupplies] = useState(String(initial.customer_supplies_labour));
  const [dumpTruck, setDumpTruck] = useState(String(initial.dump_truck_surcharge));
  const [effective, setEffective] = useState(initial.price_list_effective_date ?? "");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const counterNum = Number(counter);
    const suppliesNum = Number(supplies);
    const dumpTruckNum = Number(dumpTruck);
    // Service charge may be negative; the other amounts can't.
    if (!Number.isFinite(counterNum)) {
      toast.error("Service charge must be a number");
      return;
    }
    if ([suppliesNum, dumpTruckNum].some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error("Labour and surcharge amounts must be ≥ 0");
      return;
    }
    startTransition(async () => {
      const res = await updatePricingSettings({
        counter_premium: counterNum,
        customer_supplies_labour: suppliesNum,
        dump_truck_surcharge: dumpTruckNum,
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
        <CardTitle className="text-base">Pricing defaults</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Global defaults for the All-Filter-Price page and Print List. Service charge and
          customer-supplies labour can be overridden per part on the Parts catalogue.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Service charge ($)"
            value={counter}
            onChange={setCounter}
            min="-9999999"
            tip="Default added to Total cost to produce the With-Service price. May be negative. Per-part overrides win."
          />
          <Field
            label="Customer-supplies labour ($)"
            value={supplies}
            onChange={setSupplies}
            tip="Default flat labour fee when the customer brings their own filter. Per-part overrides win."
          />
          <Field
            label="Dump truck surcharge ($)"
            value={dumpTruck}
            onChange={setDumpTruck}
            tip="Flat amount added to a sales job's sub total when the vehicle is a dump truck. The sales form ticks the box automatically for vehicles marked as dump trucks."
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
  /** Minimum for the number input. Defaults to "0"; pass a negative to allow it. */
  min?: string;
}

function Field({ label, value, onChange, step = "0.01", tip, min = "0" }: FieldProps) {
  return (
    <div>
      <label className="text-sm font-medium flex items-center gap-1">
        {label}
        {tip ? <InfoTip>{tip}</InfoTip> : null}
      </label>
      <Input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}
