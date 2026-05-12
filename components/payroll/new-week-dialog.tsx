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
import { createPayrollWeek } from "@/lib/actions/payroll";
import { listActiveLocations } from "@/lib/actions/reference";
import type { Location } from "@/lib/db/types";

/** Snap any YYYY-MM-DD to the Monday of its week (in UTC, no DST surprises). */
function snapToMonday(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  const dow = date.getUTCDay(); // 0 = Sunday, 1 = Monday, …
  const delta = dow === 0 ? -6 : 1 - dow; // shift back to Monday
  date.setUTCDate(date.getUTCDate() + delta);
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

export function NewWeekDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const router = useRouter();

  useEffect(() => {
    listActiveLocations().then(setLocations).catch(() => {});
  }, []);

  const form = useForm<PayrollWeekInput>({
    resolver: zodResolver(PayrollWeekInput),
    defaultValues: { location_id: "", week_start: "", notes: "" },
  });

  async function onSubmit(values: PayrollWeekInput) {
    const result = await createPayrollWeek(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Payroll week created");
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New payroll week</DialogTitle>
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
              name="week_start"
              render={({ field }) => {
                const snapped = field.value ? snapToMonday(field.value) : "";
                const didSnap = snapped && snapped !== field.value;
                return (
                  <FormItem>
                    <FormLabel>Week start (Monday)</FormLabel>
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
                          if (field.value) field.onChange(snapToMonday(field.value));
                        }}
                      />
                    </FormControl>
                    {field.value && (
                      <p className="text-xs text-muted-foreground">
                        {didSnap ? (
                          <>Will snap to <strong>{formatHuman(snapped)}</strong> (Monday of that week)</>
                        ) : (
                          <>Pay week: <strong>{formatHuman(snapped)}</strong></>
                        )}
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
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
