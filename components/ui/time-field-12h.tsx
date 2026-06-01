"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// A 12-hour time entry (hour / minute / AM-PM) that stores 24-hour "HH:mm".
//
// We deliberately avoid the native <input type="time">: in 12-hour locales
// (Canada/US) it renders an AM/PM segment that the browser leaves blank when
// only digits are typed, then rejects the value as "incomplete". Splitting the
// segments ourselves keeps AM/PM always populated, so that error can't happen.
type Period = "AM" | "PM";

type Props = {
  value?: string; // "HH:mm" (24-hour) or "" when unset
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

function parse24(value?: string): { hour: string; minute: string; period: Period } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  const period: Period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { hour: String(h12), minute: String(min).padStart(2, "0"), period };
}

function to24(hour: string, minute: string, period: Period): string | null {
  if (hour === "" || minute === "") return null;
  const h12 = Number(hour);
  const min = Number(minute);
  if (Number.isNaN(h12) || Number.isNaN(min) || h12 < 1 || h12 > 12 || min > 59) return null;
  const h24 = (h12 % 12) + (period === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function TimeField12h({ value, onChange, onBlur, disabled, id, className }: Props) {
  const parsed = parse24(value);
  const [hour, setHour] = React.useState(parsed?.hour ?? "");
  const [minute, setMinute] = React.useState(parsed?.minute ?? "");
  const [period, setPeriod] = React.useState<Period>(parsed?.period ?? "AM");

  // Re-sync local segments when the controlled value changes from outside
  // (form reset, customer/vehicle prefill, etc.).
  React.useEffect(() => {
    const p = parse24(value);
    setHour(p?.hour ?? "");
    setMinute(p?.minute ?? "");
    setPeriod(p?.period ?? "AM");
  }, [value]);

  function emit(h: string, m: string, p: Period) {
    if (h === "" && m === "") {
      onChange("");
      return;
    }
    const next = to24(h, m, p);
    if (next != null) onChange(next);
  }

  function handleHour(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    setHour(v);
    emit(v, minute, period);
  }

  function handleMinute(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    setMinute(v);
    emit(hour, v, period);
  }

  function handlePeriod(p: Period) {
    setPeriod(p);
    emit(hour, minute, p);
  }

  // Tidy up on blur: pad minute, clamp hour into 1-12, then re-emit.
  function normalize() {
    let h = hour;
    let m = minute;
    if (h !== "") {
      let n = Number(h);
      if (Number.isNaN(n) || n < 1) n = 12;
      if (n > 12) n = 12;
      h = String(n);
      setHour(h);
    }
    if (m !== "") {
      let n = Number(m);
      if (Number.isNaN(n) || n > 59) n = 59;
      m = String(n).padStart(2, "0");
      setMinute(m);
    }
    emit(h, m, period);
    onBlur?.();
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label="Hour"
        placeholder="08"
        value={hour}
        disabled={disabled}
        onChange={(e) => handleHour(e.target.value)}
        onBlur={normalize}
        className="w-12 text-center tabular-nums"
      />
      <span className="text-muted-foreground">:</span>
      <Input
        type="text"
        inputMode="numeric"
        aria-label="Minute"
        placeholder="00"
        value={minute}
        disabled={disabled}
        onChange={(e) => handleMinute(e.target.value)}
        onBlur={normalize}
        className="w-12 text-center tabular-nums"
      />
      <Select value={period} onValueChange={(v) => handlePeriod(v as Period)} disabled={disabled}>
        <SelectTrigger className="w-[4.5rem]" aria-label="AM or PM">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
