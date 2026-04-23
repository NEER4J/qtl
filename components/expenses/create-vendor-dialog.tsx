"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { createVendor } from "@/lib/actions/vendors";
import { CreateVendorInput } from "@/lib/schemas/vendors";
import type { Vendor } from "@/lib/db/types";

type FormValues = {
  name: string;
  contact_no: string;
  email: string;
  account_no: string;
  account_type: string;
};

export function CreateVendorDialog({
  open,
  onOpenChange,
  defaultName,
  categoryId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  categoryId: string | null;
  onCreated: (vendor: Vendor) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    defaultValues: {
      name: defaultName ?? "",
      contact_no: "",
      email: "",
      account_no: "",
      account_type: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: defaultName ?? "",
        contact_no: "",
        email: "",
        account_no: "",
        account_type: "",
      });
    }
  }, [open, defaultName, form]);

  const onSubmit = form.handleSubmit((values) => {
    const parsed = CreateVendorInput.safeParse({
      name: values.name,
      contact_no: values.contact_no || null,
      email: values.email || null,
      account_no: values.account_no || null,
      account_type: values.account_type || null,
      category_id: categoryId,
      notes: null,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in values) {
          form.setError(key as keyof FormValues, { message: issue.message });
        }
      }
      return;
    }

    startTransition(async () => {
      const res = await createVendor(parsed.data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Created ${res.data.name}`);
      onCreated(res.data);
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New vendor</DialogTitle>
          <DialogDescription>Saved to the vendor directory.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="contact_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="account_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account #</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account type</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
