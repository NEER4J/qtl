"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { createEmployee, updateEmployee } from "@/lib/actions/payroll";
import type { LinkableProfile } from "@/lib/actions/payroll";
import type { Employee, Location } from "@/lib/db/types";

// Radix Select can't hold an empty-string value, so "none" uses a sentinel.
const NO_LOCATION = "__none__";
const NO_USER = "__none__";

type FormValues = {
  full_name: string;
  code: string;
  payroll_type: "employee" | "management";
  default_hourly_rate: string;
  location_id: string;
  profile_id: string;
  sin_last4: string;
  hire_date: string;
  termination_date: string;
  notes: string;
};

const blank: FormValues = {
  full_name: "",
  code: "",
  payroll_type: "employee",
  default_hourly_rate: "0",
  location_id: NO_LOCATION,
  profile_id: NO_USER,
  sin_last4: "",
  hire_date: "",
  termination_date: "",
  notes: "",
};

export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  employee,
  locations,
  profiles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  employee?: Employee;
  locations: Location[];
  profiles: LinkableProfile[];
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: blank });

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && employee
        ? {
            full_name: employee.full_name,
            code: employee.code ?? "",
            payroll_type: employee.payroll_type,
            default_hourly_rate: String(employee.default_hourly_rate ?? 0),
            location_id: employee.location_id ?? NO_LOCATION,
            profile_id: employee.profile_id ?? NO_USER,
            sin_last4: employee.sin_last4 ?? "",
            hire_date: employee.hire_date ?? "",
            termination_date: employee.termination_date ?? "",
            notes: employee.notes ?? "",
          }
        : blank,
    );
  }, [open, mode, employee, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        full_name: values.full_name.trim(),
        code: values.code.trim() === "" ? null : values.code.trim(),
        payroll_type: values.payroll_type,
        default_hourly_rate: Number(values.default_hourly_rate) || 0,
        location_id: values.location_id === NO_LOCATION ? null : values.location_id,
        profile_id: values.profile_id === NO_USER ? null : values.profile_id,
        sin_last4: values.sin_last4.trim() === "" ? null : values.sin_last4.trim(),
        hire_date: values.hire_date || null,
        termination_date: values.termination_date || null,
        notes: values.notes.trim() === "" ? null : values.notes.trim(),
      };
      const res =
        mode === "create"
          ? await createEmployee(payload)
          : await updateEmployee({ ...payload, id: employee!.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "create" ? "Employee added" : "Employee updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New employee" : "Edit employee"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="payroll_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_hourly_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default hourly rate</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_LOCATION}>No location</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="profile_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked login user</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_USER}>Not linked</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.username || "—"} ({p.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Link a login so this person can see their own pay on the My Pay page.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee code (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. EMP-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sin_last4"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SIN last 4 (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="1234" maxLength={4} inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="hire_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hire date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="termination_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Termination date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
