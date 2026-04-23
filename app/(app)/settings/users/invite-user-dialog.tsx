"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { inviteUser } from "@/lib/actions/users";
import { InviteUserInput } from "@/lib/schemas/users";
import type { Location, UserRole } from "@/lib/db/types";

const ROLE_OPTIONS: { value: UserRole; label: string; helper: string }[] = [
  { value: "owner", label: "Owner", helper: "Full access to every location." },
  { value: "manager", label: "Manager", helper: "Manages one location." },
  { value: "accountant", label: "Accountant", helper: "Cross-location access to expenses and payroll." },
  { value: "staff", label: "Staff", helper: "Front-line user at one location." },
  { value: "employee", label: "Employee", helper: "Can only see own pay stubs." },
];

export function InviteUserDialog({
  open,
  onOpenChange,
  locations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(InviteUserInput),
    defaultValues: {
      email: "",
      full_name: "",
      role: "staff",
      location_id: null,
      can_enter_expenses: false,
    },
  });

  const role = form.watch("role");
  const showLocation = role === "manager" || role === "staff" || role === "employee";
  const showExpensesFlag = role === "staff";

  const onSubmit = (values: InviteUserInput) => {
    startTransition(async () => {
      const res = await inviteUser(values);
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof InviteUserInput, { message: v[0] });
          }
        }
        return;
      }
      toast.success(`Invite sent to ${res.data.email}`);
      form.reset();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            An email invite will be sent. They set their own password via the link.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@qtl.ca" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {ROLE_OPTIONS.find((o) => o.value === field.value)?.helper}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showLocation && (
              <FormField
                control={form.control}
                name="location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v || null)}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign to a location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations
                          .filter((l) => l.active)
                          .map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showExpensesFlag && (
              <FormField
                control={form.control}
                name="can_enter_expenses"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Can enter expenses</FormLabel>
                      <FormDescription>
                        Allow this staff member to record expenses for their location.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Sending invite…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
