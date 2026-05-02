"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatPhone, normalizePhone } from "@/lib/utils/phone";

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value?: string;
  onChange?: (rawDigits: string) => void;
};

// Item #13: NA phone-number input. Shows "(647) 804-9571" while typing,
// emits the digit-only string upstream so storage stays normalized.
const PhoneInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(formatPhone(value ?? ""));

    React.useEffect(() => {
      setDisplay(formatPhone(value ?? ""));
    }, [value]);

    return (
      <Input
        ref={ref}
        inputMode="tel"
        autoComplete="tel"
        placeholder="xxx-xxx-xxxx"
        maxLength={12}
        {...props}
        value={display}
        onChange={(e) => {
          // Cap at 10 digits — drop any 11th the user types.
          const digits = normalizePhone(e.target.value).slice(0, 10);
          setDisplay(formatPhone(digits));
          onChange?.(digits);
        }}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
