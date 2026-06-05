"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { ChangeOwnPasswordInput } from "@/lib/schemas/profile";
import { changeOwnPassword } from "@/lib/actions/profile";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ChangeOwnPasswordInput>({
    resolver: zodResolver(ChangeOwnPasswordInput),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = (values: ChangeOwnPasswordInput) => {
    startTransition(async () => {
      const res = await changeOwnPassword(values);
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [key, msgs] of Object.entries(res.fieldErrors)) {
            form.setError(key as keyof ChangeOwnPasswordInput, { message: msgs[0] });
          }
        } else if (/current password/i.test(res.error)) {
          // The action throws a plain "Current password is incorrect" — pin it
          // to the right field instead of only flashing a toast.
          form.setError("current_password", { message: res.error });
        } else {
          toast.error(res.error);
        }
        return;
      }
      form.reset({ current_password: "", new_password: "", confirm_password: "" });
      toast.success("Password changed");
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="current_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="new_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>At least 6 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Updating…" : "Change password"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
