"use client";

import { useState, useTransition } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { EmptyDropdownHint } from "@/components/help/empty-state";
import { inviteUser, type UserListRow } from "@/lib/actions/users";
import { InviteUserInput, isUsernameRole } from "@/lib/schemas/users";
import type { Location, UserRole } from "@/lib/db/types";

import { PermissionsMatrix } from "./permissions-matrix";

const ROLE_OPTIONS: { value: UserRole; label: string; helper: string }[] = [
  { value: "owner", label: "Owner", helper: "Full access to all business data and every location, EXCEPT the Settings section. Logs in with email." },
  { value: "co_owner", label: "Admin", helper: "Full access to everything, including Settings — manages the whole platform. Logs in with a username (email optional)." },
  { value: "manager", label: "Manager", helper: "Manages one location. Logs in with username." },
  { value: "supervisor", label: "Supervisor", helper: "Same access as a manager, for one location. Logs in with username." },
  { value: "accountant", label: "Accountant", helper: "Cross-location access to expenses and payroll. Logs in with email." },
  { value: "staff", label: "Staff", helper: "Front-line user at one location. Logs in with username." },
  { value: "technician", label: "Technician", helper: "Same access as front-line staff, for one location. Logs in with username." },
  { value: "employee", label: "Employee", helper: "Can only see own pay stubs. Logs in with username." },
];

export function InviteUserDialog({
  open,
  onOpenChange,
  locations,
  otherUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  otherUsers?: UserListRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(InviteUserInput),
    defaultValues: {
      email: null,
      username: null,
      full_name: "",
      role: "staff",
      location_id: null,
      can_enter_expenses: false,
      cross_location: false,
      password: "",
      allowed_pages: null,
      hidden_columns: {},
    },
  });

  const role = form.watch("role");
  const password = form.watch("password") ?? "";
  const usernameMode = isUsernameRole(role);
  const showLocation =
    role === "manager" || role === "supervisor" || role === "staff" || role === "technician" || role === "employee";
  const showExpensesFlag = role === "staff" || role === "technician";
  const showCrossLocation =
    role === "manager" || role === "supervisor" || role === "staff" || role === "technician" || role === "employee";

  const resetState = () => {
    form.reset();
    setConfirmPassword("");
    setConfirmError(null);
  };

  const onSubmit = (values: InviteUserInput) => {
    if (values.password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      return;
    }

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
      toast.success(
        res.data.existed
          ? `${res.data.identity} already existed — password updated`
          : `${res.data.identity} created`,
      );
      resetState();
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetState();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            Create the account with a password you set now. The user can sign in
            immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="profile">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4 pt-2">
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
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={(v) => {
                          field.onChange(v);
                          // Manager & Supervisor default to all-locations.
                          if (v === "manager" || v === "supervisor") {
                            form.setValue("cross_location", true, { shouldDirty: true });
                          }
                        }}
                        value={field.value}
                      >
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

                {/* Identity field: username for team members, email for owner/accountant. */}
                {usernameMode ? (
                  <>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="jdoe"
                              autoComplete="off"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormDescription>
                            Lowercase letters, numbers, dots, underscores or hyphens. This is what the user types on the login screen.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Used for password reset only"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="jane@qtl.ca"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {showLocation && (() => {
                  const activeLocations = locations.filter((l) => l.active);
                  return (
                    <FormField
                      control={form.control}
                      name="location_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          {activeLocations.length === 0 ? (
                            <EmptyDropdownHint
                              message="No shop locations have been added yet. A Manager, Staff, or Employee must be assigned to a shop before you can add them."
                              actionLabel="Add a location first"
                              href="/settings/locations"
                            />
                          ) : (
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
                                {activeLocations.map((l) => (
                                  <SelectItem key={l.id} value={l.id}>
                                    {l.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })()}

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

                {showCrossLocation && (
                  <FormField
                    control={form.control}
                    name="cross_location"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Access to all locations</FormLabel>
                          <FormDescription>
                            Lets this user act on every shop, not just their assigned one.
                            Their home location above is still recorded for reporting.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="At least 6 characters"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (confirmError) setConfirmError(null);
                      }}
                    />
                  </FormControl>
                  {confirmError && (
                    <p className="text-sm text-destructive">{confirmError}</p>
                  )}
                  {!confirmError && password && confirmPassword && password !== confirmPassword && (
                    <p className="text-sm text-destructive">Passwords do not match</p>
                  )}
                </FormItem>
              </TabsContent>

              <TabsContent value="permissions" className="pt-2">
                {role === "owner" || role === "co_owner" ? (
                  <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                    {role === "co_owner"
                      ? "Admins have full access to every page and column, including Settings."
                      : "Owners have full access to everything except the Settings section."}{" "}
                    Page and column overrides don&apos;t apply.
                  </div>
                ) : (
                  <PermissionsMatrix
                    // Re-seed when the role changes — the matrix only reads
                    // its props on mount, so without this the defaults shown
                    // stay those of the role first selected.
                    key={role}
                    role={role}
                    allowedPages={form.watch("allowed_pages") ?? null}
                    hiddenColumns={form.watch("hidden_columns") ?? {}}
                    otherUsers={otherUsers}
                    onChange={({ allowed_pages, hidden_columns }) => {
                      form.setValue("allowed_pages", allowed_pages, { shouldDirty: true });
                      form.setValue("hidden_columns", hidden_columns, { shouldDirty: true });
                    }}
                  />
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetState();
                  onOpenChange(false);
                }}
                disabled={isPending}
              >
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
