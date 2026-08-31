"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayrollWeekInput } from "@/lib/schemas/payroll";
import { EmptyDropdownHint } from "@/components/help/empty-state";
import { createPayrollWeek, updatePayrollWeek } from "@/lib/actions/payroll";
import { listActiveLocations } from "@/lib/actions/reference";
import type { Location, PayrollWeek } from "@/lib/db/types";

/** Snap any YYYY-MM-DD to the Sunday of its week (in UTC, no DST surprises). */
function snapToSunday(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  const dow = date.getUTCDay(); // 0 = Sunday
  date.setUTCDate(date.getUTCDate() - dow); // shift back to Sunday
  return date.toISOString().slice(0, 10);
}

/** Add n days to a YYYY-MM-DD (UTC). */
function addDays(ymd: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function formatHuman(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d)).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Only the editable fields — the caller holds a full week with its entries and
 *  payments attached, and none of that needs to cross to the client. */
type EditableWeek = Pick<
  PayrollWeek,
  "id" | "location_id" | "week_start" | "period_weeks" | "notes"
>;

interface Props {
  /** Omit to create a new week; pass the week to edit an existing one. */
  week?: EditableWeek;
  children: React.ReactNode;
}

/**
 * Create OR edit a pay week. Editing exists because a week opened on the wrong
 * Sunday, the wrong shop, or the wrong period length was previously permanent —
 * the only escape was to abandon it and start another.
 */
export function WeekFormDialog({ week, children }: Props) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const router = useRouter();
  const isEdit = !!week;

  useEffect(() => {
    listActiveLocations().then(setLocations).catch(() => {});
  }, []);

  const form = useForm<PayrollWeekInput>({
    resolver: zodResolver(PayrollWeekInput),
    defaultValues: week
      ? {
          location_id: week.location_id,
          week_start: week.week_start,
          period_weeks: week.period_weeks,
          notes: week.notes ?? "",
        }
      : { location_id: "", week_start: "", period_weeks: 1, notes: "" },
  });

  async function onSubmit(values: PayrollWeekInput) {
    const result = week
      ? await updatePayrollWeek({ ...values, id: week.id })
      : await createPayrollWeek(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Payroll week updated" : "Payroll week created");
    setOpen(false);
    if (!isEdit) form.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit payroll week" : "New payroll week"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  {locations.length === 0 ? (
                    <EmptyDropdownHint
                      message="No shop locations have been added yet."
                      actionLabel="Add a location"
                      href="/settings/locations"
                    />
                  ) : (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="period_weeks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period</FormLabel>
                  <Select
                    value={String(field.value ?? 1)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Weekly (Sun–Sat)</SelectItem>
                      <SelectItem value="2">Bi-weekly (2 weeks)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="week_start"
              render={({ field }) => {
                const snapped = field.value ? snapToSunday(field.value) : "";
                const didSnap = snapped && snapped !== field.value;
                const periodWeeks = Number(form.watch("period_weeks") ?? 1);
                const endDate = snapped ? addDays(snapped, periodWeeks * 7 - 1) : "";
                return (
                  <FormItem>
                    <FormLabel>Week start (Sunday)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          // Snap on blur, not on change — otherwise the date
                          // picker jumps while the user is still picking.
                          field.onChange(v);
                        }}
                        onBlur={() => {
                          if (field.value) field.onChange(snapToSunday(field.value));
                        }}
                      />
                    </FormControl>
                    {field.value && (
                      <p className="text-xs text-muted-foreground">
                        {didSnap && <>Snaps to the Sunday of that week. </>}
                        Pay period: <strong>{formatHuman(snapped)}</strong> →{" "}
                        <strong>{formatHuman(endDate)}</strong>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Moving the start date or period does not touch the entries already on this
                week — check the hours still line up with the new dates.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Back-compat alias for the "New week" button on the payroll list page. */
export function NewWeekDialog({ children }: { children: React.ReactNode }) {
  return <WeekFormDialog>{children}</WeekFormDialog>;
}
