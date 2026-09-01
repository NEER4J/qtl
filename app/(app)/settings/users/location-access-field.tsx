"use client";

import { Building2, Check, Globe, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { LocationMode } from "@/lib/auth/locations";
import type { Location } from "@/lib/db/types";

interface Props {
  /** All active locations the admin can grant. */
  locations: Location[];
  /** The user's home location (the existing "Location" select above this). */
  homeId: string | null;
  mode: LocationMode;
  /** Extra locations ticked in Multiple mode (home is implicit, always on). */
  extraIds: string[];
  onChange: (next: { mode: LocationMode; extraIds: string[] }) => void;
}

const MODES: { value: LocationMode; label: string; hint: string; icon: typeof Globe }[] = [
  { value: "single", label: "Single", hint: "Home location only", icon: MapPin },
  { value: "multi", label: "Multiple", hint: "Pick which shops", icon: Building2 },
  { value: "all", label: "All", hint: "Every shop", icon: Globe },
];

export function LocationAccessField({
  locations,
  homeId,
  mode,
  extraIds,
  onChange,
}: Props) {
  const home = locations.find((l) => l.id === homeId) ?? null;
  // Home is granted by RLS whatever else is set, so it is shown ticked and
  // locked rather than offered as a toggle that wouldn't actually do anything.
  const others = locations.filter((l) => l.id !== homeId);
  const enabled = new Set(extraIds);

  const toggle = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ mode: "multi", extraIds: [...next] });
  };

  const grantedCount =
    mode === "all" ? locations.length : mode === "multi" ? enabled.size + (home ? 1 : 0) : home ? 1 : 0;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-none">Location access</p>
          <p className="text-[11px] text-muted-foreground">
            Which shops this user can see and work in.
          </p>
        </div>
        <Badge variant="secondary" className="font-normal">
          {mode === "all"
            ? "All locations"
            : `${grantedCount} of ${locations.length}`}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange({ mode: m.value, extraIds })}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-muted/60",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="size-3.5" />
                {m.label}
                {active && <Check className="size-3 text-primary" />}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {m.hint}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "multi" && (
        <div className="space-y-1.5">
          {locations.length <= 1 ? (
            <p className="text-xs text-muted-foreground">
              There is only one location, so Multiple is the same as Single.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Turn each shop on or off for this user.
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    disabled={others.every((l) => enabled.has(l.id))}
                    onClick={() =>
                      onChange({ mode: "multi", extraIds: others.map((l) => l.id) })
                    }
                  >
                    Enable all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    disabled={enabled.size === 0}
                    onClick={() => onChange({ mode: "multi", extraIds: [] })}
                  >
                    Disable all
                  </Button>
                </div>
              </div>
              <ul className="divide-y rounded-md border">
                {home && (
                  <li className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                    <Checkbox checked disabled className="size-4" />
                    <span className="flex-1 truncate">{home.name}</span>
                    <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
                      home
                    </Badge>
                  </li>
                )}
                {others.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-muted/40">
                      <Checkbox
                        checked={enabled.has(l.id)}
                        onCheckedChange={() => toggle(l.id)}
                        className="size-4"
                      />
                      <span
                        className={cn(
                          "flex-1 truncate",
                          !enabled.has(l.id) && "text-muted-foreground",
                        )}
                      >
                        {l.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                The home location above is always included — it&apos;s where this
                user&apos;s new records are filed.
              </p>
            </>
          )}
        </div>
      )}

      {mode === "all" && (
        <p className="text-[11px] text-muted-foreground">
          Sees and works in every shop, including any added later. The home
          location is still recorded for reporting.
        </p>
      )}
    </div>
  );
}
