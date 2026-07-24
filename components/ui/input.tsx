import * as React from "react";

import { cn } from "@/lib/utils";

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

/** "" for null/undefined, otherwise the value as a string. */
function toText(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

/** Numeric form of a buffer/value; blank or in-progress ("-", ".", "-.") → 0. */
function toNum(s: string): number {
  if (s === "" || s === "-" || s === "." || s === "-.") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Drop a leading zero that sits in front of another digit: "09" → "9", "-05" → "-5". */
function stripLeadingZeros(raw: string): string {
  return raw.replace(/^(-?)0+(?=\d)/, "$1");
}

/**
 * Number input that keeps a local text buffer so a lone "0" can be cleared and
 * re-typed. A plainly-controlled `value={someNumber}` snaps the field back to
 * "0" the instant it's emptied (Number("") → 0), which made the "0" feel
 * undeletable — typing then produced "90"/"09". The buffer allows an empty (or
 * in-progress "-"/".") value while editing, strips leading zeros, and still
 * emits the normalized string through the original onChange so react-hook-form
 * and manual `value`/`onChange` consumers keep working unchanged.
 */
const NumberInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, value, onChange, ...props }, ref) => {
  const [text, setText] = React.useState<string>(() => toText(value));
  // The number this buffer currently represents. We only pull a new value in
  // from the parent when it differs numerically from what we already show, so
  // an in-progress "", "1." or "-" is never clobbered by the round-trip.
  const shownNum = React.useRef<number>(toNum(toText(value)));

  React.useEffect(() => {
    const incoming = toText(value);
    if (toNum(incoming) !== shownNum.current) {
      shownNum.current = toNum(incoming);
      setText(incoming);
    }
    // Intentionally keyed on `value` only; `text`/`shownNum` are internal.
  }, [value]);

  return (
    <input
      {...props}
      ref={ref}
      type="number"
      value={text}
      className={cn(inputClass, className)}
      onChange={(e) => {
        const normalized = stripLeadingZeros(e.target.value);
        setText(normalized);
        shownNum.current = toNum(normalized);
        if (onChange) {
          if (e.target.value !== normalized) e.target.value = normalized;
          onChange(e);
        }
      }}
    />
  );
});
NumberInput.displayName = "NumberInput";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    if (type === "number") {
      return <NumberInput className={className} {...props} ref={ref} />;
    }
    return (
      <input
        type={type}
        className={cn(inputClass, className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
