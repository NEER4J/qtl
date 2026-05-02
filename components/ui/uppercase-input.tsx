"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "onChange"> & {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

// Item #12: an Input that uppercases on every keystroke. Useful for fields
// where mixed case is never desired (license_plate, vin, customer name).
const UppercaseInput = React.forwardRef<HTMLInputElement, Props>(
  ({ className, onChange, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        className={cn("uppercase tracking-wide", className)}
        autoCapitalize="characters"
        spellCheck={false}
        onChange={(e) => {
          const upper = e.target.value.toUpperCase();
          if (e.target.value !== upper) e.target.value = upper;
          onChange?.(e);
        }}
        {...props}
      />
    );
  },
);
UppercaseInput.displayName = "UppercaseInput";

export { UppercaseInput };
