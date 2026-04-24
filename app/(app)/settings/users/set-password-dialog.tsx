"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { setUserPassword, type UserListRow } from "@/lib/actions/users";
import { SetUserPasswordInput } from "@/lib/schemas/users";

export function SetPasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserListRow;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const form = useForm<SetUserPasswordInput>({
    resolver: zodResolver(SetUserPasswordInput),
    defaultValues: { id: "", password: "" },
  });

  useEffect(() => {
    if (user && open) {
      form.reset({ id: user.id, password: "" });
      setConfirmPassword("");
      setConfirmError(null);
    }
  }, [user, open, form]);

  const password = form.watch("password");

  const onSubmit = (values: SetUserPasswordInput) => {
    if (values.password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      return;
    }
    startTransition(async () => {
      const res = await setUserPassword(values);
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof SetUserPasswordInput, { message: v[0] });
          }
        }
        return;
      }
      toast.success(`Password updated for ${user?.email ?? "user"}`);
      onOpenChange(false);
    });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.full_name || user.email}. They can sign in
            with it immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
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
              {!confirmError &&
                password &&
                confirmPassword &&
                password !== confirmPassword && (
                  <p className="text-sm text-destructive">Passwords do not match</p>
                )}
            </FormItem>

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
                {isPending ? "Updating…" : "Update password"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
