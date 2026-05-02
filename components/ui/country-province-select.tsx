"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, getProvinces } from "@/lib/data/regions";

type CountryProps = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
};

export function CountrySelect({ value, onChange, disabled }: CountryProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select country" />
      </SelectTrigger>
      <SelectContent>
        {COUNTRIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type ProvinceProps = {
  country: string;
  value: string | null | undefined;
  onChange: (code: string) => void;
  disabled?: boolean;
};

export function ProvinceSelect({ country, value, onChange, disabled }: ProvinceProps) {
  const provinces = getProvinces(country);
  const placeholder = country === "US" ? "Select state" : "Select province";

  // If country changed and value is no longer valid, clear it.
  React.useEffect(() => {
    if (value && !provinces.some((p) => p.code === value || p.name === value)) {
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled || provinces.length === 0}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {provinces.map((p) => (
          <SelectItem key={p.code} value={p.code}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
