"use client";

import { useEffect, useTransition } from "react";
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
import { updateUser, type UserListRow } from "@/lib/actions/users";
import { UpdateUserInput, isSyntheticEmail, isUsernameRole } from "@/lib/schemas/users";
import type { Location, UserRole } from "@/lib/db/types";

import { PermissionsMatrix } from "./permissions-matrix";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "co_owner", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "accountant", label: "Accountant" },
  { value: "staff", label: "Staff" },
  { value: "technician", label: "Technician" },
  { value: "employee", label: "Employee" },
];

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  locations,
  otherUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserListRow;
  locations: Location[];
  otherUsers?: UserListRow[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(UpdateUserInput),
    defaultValues: {
      id: "",
      email: null,
      username: null,
      full_name: "",
      role: "staff",
      location_id: null,
      can_enter_expenses: false,
      cross_location: false,
      active: true,
      allowed_pages: null,
      hidden_columns: {},
    },
  });

  useEffect(() => {
    if (user && open) {
      // The synthetic email for username users shouldn't be shown in the form's
      // Email field. Hide it from the UI when the role uses username login.
      const isUsernameUser = isUsernameRole(user.role) && !!user.username;
      const synthetic = isSyntheticEmail(user.email);
      const visibleEmail = isUsernameUser && synthetic ? null : user.email;

      form.reset({
        id: user.id,
        email: visibleEmail,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        location_id: user.location_id,
        can_enter_expenses: user.can_enter_expenses,
        cross_location: user.cross_location,
        active: user.active,
        allowed_pages: user.allowed_pages,
        hidden_columns: user.hidden_columns ?? {},
      });
    }
  }, [user, open, form]);

  const role = form.watch("role");
  const usernameMode = isUsernameRole(role);
  const showLocation =
    role === "manager" || role === "supervisor" || role === "staff" || role === "technician" || role === "employee";
  const showExpensesFlag = role === "staff" || role === "technician";
  const showCrossLocation =
    role === "manager" || role === "supervisor" || role === "staff" || role === "technician" || role === "employee";

  const onSubmit = (values: UpdateUserInput) => {
    startTransition(async () => {
      const res = await updateUser(values);
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof UpdateUserInput, { message: v[0] });
          }
        }
        return;
      }
      toast.success("User updated");
      onOpenChange(false);
    });
  };

  if (!user) return null;

  const filteredOthers = otherUsers?.filter((u) => u.id !== user.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            {user.username ? `@${user.username}` : user.email}
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
                        <Input {...field} />
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
                            <SelectValue />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Identity */}
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
                            What the user types on the login screen.
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
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                            The home location is still recorded for reporting.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Inactive users cannot sign in. Their history is preserved.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
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
                    role={role}
                    allowedPages={form.watch("allowed_pages") ?? null}
                    hiddenColumns={form.watch("hidden_columns") ?? {}}
                    otherUsers={filteredOthers}
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
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
