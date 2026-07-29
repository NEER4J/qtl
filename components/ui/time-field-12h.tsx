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
// Hour and minute are typeable inputs with a dropdown of suggestions (native
// <datalist>): you can type the number directly OR pick it from the list.
// AM/PM stays a small dropdown. We deliberately avoid the native
// <input type="time">: in 12-hour locales (Canada/US) it renders an AM/PM
// segment the browser leaves blank when only digits are typed, then rejects the
// value as "incomplete".
type Period = "AM" | "PM";

type Props = {
  value?: string; // "HH:mm" (24-hour) or "" when unset
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

// Dropdown suggestions. Hours are 1-12; minutes are offered in 5-minute steps
// for quick picking, but any minute 0-59 can be typed.
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

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
  // Do not commit a partially typed minute. Committing "0" as "00" causes the
  // controlled value to immediately re-render as "00", which traps the cursor
  // and prevents replacing a leading zero with a complete value such as "25".
  // A single digit is padded and committed by onMinuteBlur instead.
  if (hour === "" || !/^\d{2}$/.test(minute)) return null;
  const h12 = Number(hour);
  const min = Number(minute);
  if (Number.isNaN(h12) || Number.isNaN(min) || h12 < 1 || h12 > 12 || min > 59) return null;
  const h24 = (h12 % 12) + (period === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Keep only digits, cap at two, and if a two-digit value overflows `max` keep
// just the last digit typed (so "5" then "3" in the hour box lands on "3" rather
// than a rejected "53") — mirrors the old two-digit-typeahead behaviour.
function sanitize(raw: string, max: number): string {
  let s = raw.replace(/\D/g, "").slice(0, 2);
  if (s.length === 2 && Number(s) > max) s = s.slice(-1);
  return s;
}

export function TimeField12h({ value, onChange, onBlur, disabled, id, className }: Props) {
  const parsed = parse24(value);
  const [hour, setHour] = React.useState(parsed?.hour ?? "");
  const [minute, setMinute] = React.useState(parsed?.minute ?? "");
  const [period, setPeriod] = React.useState<Period>(parsed?.period ?? "AM");

  // Unique ids so multiple TimeFields on one page don't share <datalist>s.
  const reactId = React.useId();
  const hourListId = `time-hours-${reactId}`;
  const minuteListId = `time-minutes-${reactId}`;

  // Re-sync local segments when the controlled value changes from outside
  // (form reset, customer/vehicle prefill, etc.).
  React.useEffect(() => {
    const p = parse24(value);
    setHour(p?.hour ?? "");
    setMinute(p?.minute ?? "");
    setPeriod(p?.period ?? "AM");
  }, [value]);

  function emit(h: string, m: string, p: Period, blur: boolean) {
    if (h === "" && m === "") {
      onChange("");
    } else {
      const next = to24(h, m, p);
      if (next != null) onChange(next);
      else if (blur && (h === "" || m === "")) onChange("");
    }
    if (blur) onBlur?.();
  }

  function onHourChange(raw: string) {
    const s = sanitize(raw, 12);
    setHour(s);
    emit(s, minute, period, false);
  }

  function onMinuteChange(raw: string) {
    const s = sanitize(raw, 59);
    setMinute(s);
    emit(hour, s, period, false);
  }

  // On blur, normalise: clamp the hour into 1-12 and pad the minute to two
  // digits, then commit. Mark the field touched for the surrounding form.
  function onHourBlur() {
    let s = hour;
    if (s !== "") s = String(Math.min(12, Math.max(1, Number(s) || 1)));
    setHour(s);
    emit(s, minute, period, true);
  }

  function onMinuteBlur() {
    let s = minute;
    if (s !== "") s = String(Math.min(59, Number(s) || 0)).padStart(2, "0");
    setMinute(s);
    emit(hour, s, period, true);
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        list={hourListId}
        aria-label="Hour"
        placeholder="Hr"
        className="w-[4.5rem]"
        disabled={disabled}
        value={hour}
        onChange={(e) => onHourChange(e.target.value)}
        onBlur={onHourBlur}
      />
      <datalist id={hourListId}>
        {HOUR_OPTIONS.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>

      <span className="text-muted-foreground">:</span>

      <Input
        type="text"
        inputMode="numeric"
        list={minuteListId}
        aria-label="Minute"
        placeholder="Min"
        className="w-[4.5rem]"
        disabled={disabled}
        value={minute}
        onChange={(e) => onMinuteChange(e.target.value)}
        onBlur={onMinuteBlur}
      />
      <datalist id={minuteListId}>
        {MINUTE_OPTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <Select
        value={period}
        onValueChange={(v) => {
          setPeriod(v as Period);
          emit(hour, minute, v as Period, true);
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
