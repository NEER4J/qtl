"use client";

import { useEffect, useTransition } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createCustomer } from "@/lib/actions/customers";
import { CreateCustomerInput } from "@/lib/schemas/customers";
import type { Customer } from "@/lib/db/types";

export function CreateCustomerDialog({
  open,
  onOpenChange,
  defaultName,
  defaultPlate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  defaultPlate?: string;
  onCreated: (customer: Customer) => void;
}) {
  const [isPending, startTransition] = useTransition();

  // We use a simple text input for plates (comma separated) and transform
  // on submit. Keep the form shape aligned with the zod schema.
  const form = useForm<{
    billing_name: string;
    contact_no: string;
    email: string;
    plates_raw: string;
  }>({
    defaultValues: {
      billing_name: defaultName ?? "",
      contact_no: "",
      email: "",
      plates_raw: defaultPlate ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        billing_name: defaultName ?? "",
        contact_no: "",
        email: "",
        plates_raw: defaultPlate ?? "",
      });
    }
  }, [open, defaultName, defaultPlate, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const plates = values.plates_raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const parsed = CreateCustomerInput.safeParse({
      billing_name: values.billing_name,
      contact_no: values.contact_no || null,
      email: values.email || null,
      license_plates: plates,
      home_location_id: null,
      notes: null,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in values) {
          form.setError(key as keyof typeof values, { message: issue.message });
        }
      }
      return;
    }

    startTransition(async () => {
      const res = await createCustomer(parsed.data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Created ${res.data.billing_name}`);
      onCreated(res.data);
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>
            Saved to the customer directory. You can edit details later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="billing_name"
              rules={{ required: "Billing name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing name</FormLabel>
                  <FormControl>
                    <Input placeholder="ABC Trucking Ltd." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plates_raw"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License plates</FormLabel>
                  <FormControl>
                    <Input placeholder="ABC 123, XYZ 789" {...field} />
                  </FormControl>
                  <FormDescription>Comma-separated. Stored uppercase.</FormDescription>
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
                      <Input placeholder="(226) 555-0100" {...field} />
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
                      <Input type="email" placeholder="billing@abc.ca" {...field} />
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
