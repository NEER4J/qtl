"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// A 12-hour time entry (hour / minute / AM-PM) that stores 24-hour "HH:mm".
//
// Dropdowns for hour (1-12) and minute (15-min steps) + AM/PM. We deliberately
// avoid the native <input type="time">: in 12-hour locales (Canada/US) it
// renders an AM/PM segment the browser leaves blank when only digits are typed,
// then rejects the value as "incomplete".
type Period = "AM" | "PM";

type Props = {
  value?: string; // "HH:mm" (24-hour) or "" when unset
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

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
      onBlur?.();
      return;
    }
    const next = to24(h, m, p);
    if (next != null) onChange(next);
    onBlur?.();
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Select
        value={hour}
        onValueChange={(v) => {
          setHour(v);
          emit(v, minute, period);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-[4.5rem]" aria-label="Hour">
          <SelectValue placeholder="Hr" />
        </SelectTrigger>
        <SelectContent>
          {HOUR_OPTIONS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select
        value={minute}
        onValueChange={(v) => {
          setMinute(v);
          emit(hour, v, period);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[4.5rem]" aria-label="Minute">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {MINUTE_OPTIONS.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={period}
        onValueChange={(v) => {
          setPeriod(v as Period);
          emit(hour, minute, v as Period);
        }}
        disabled={disabled}
      >
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
