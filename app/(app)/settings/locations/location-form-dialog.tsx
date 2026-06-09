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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CreateLocationInput as CreateSchema,
  UpdateLocationInput as UpdateSchema,
} from "@/lib/schemas/locations";
import { createLocation, updateLocation } from "@/lib/actions/locations";
import type { Location } from "@/lib/db/types";

type Mode = "create" | "edit";

export function LocationFormDialog({
  open,
  onOpenChange,
  mode,
  location,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  location?: Location;
}) {
  const [isPending, startTransition] = useTransition();

  // `CreateSchema` also covers the editable fields; in edit mode we tuck the
  // id in separately when submitting.
  const form = useForm<CreateSchema>({
    resolver: zodResolver(CreateSchema),
    defaultValues: {
      code: "",
      name: "",
      address: "",
      phone: "",
      email: "",
      invoice_name: "",
      fax: "",
      hst_number: "",
      active: true,
    },
  });

  useEffect(() => {
    if (mode === "edit" && location) {
      form.reset({
        code: location.code,
        name: location.name,
        address: location.address ?? "",
        phone: location.phone ?? "",
        email: location.email ?? "",
        invoice_name: location.invoice_name ?? "",
        fax: location.fax ?? "",
        hst_number: location.hst_number ?? "",
        active: location.active,
      });
    } else if (mode === "create") {
      form.reset({
        code: "",
        name: "",
        address: "",
        phone: "",
        email: "",
        invoice_name: "",
        fax: "",
        hst_number: "",
        active: true,
      });
    }
  }, [mode, location, form, open]);

  const onSubmit = (values: CreateSchema) => {
    startTransition(async () => {
      if (mode === "create") {
        const res = await createLocation(values);
        if (!res.ok) {
          toast.error(res.error);
          applyFieldErrors(res.fieldErrors);
          return;
        }
        toast.success(`Created ${res.data.name}`);
      } else if (location) {
        const payload = { ...values, id: location.id } satisfies UpdateSchema;
        const res = await updateLocation(payload);
        if (!res.ok) {
          toast.error(res.error);
          applyFieldErrors(res.fieldErrors);
          return;
        }
        toast.success(`Updated ${res.data.name}`);
      }
      onOpenChange(false);
    });
  };

  const applyFieldErrors = (fieldErrors: Record<string, string[]> | undefined) => {
    if (!fieldErrors) return;
    for (const [key, msgs] of Object.entries(fieldErrors)) {
      form.setError(key as keyof CreateSchema, { message: msgs[0] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New location" : "Edit location"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new QTL shop. The code is a short identifier used internally (e.g. AYR, FE, NP)."
              : "Update this location's details."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input placeholder="AYR" maxLength={10} {...field} />
                  </FormControl>
                  <FormDescription>Short uppercase identifier. Immutable after first use in records.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Ayr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, Ayr, ON" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(226) 555-0100" {...field} value={field.value ?? ""} />
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
                      <Input type="email" placeholder="ayr@qtl.ca" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-medium">Invoice header</p>
              <p className="-mt-2 text-xs text-muted-foreground">
                Printed at the top of invoices for jobs at this location. Leave a field blank to fall back to the name.
              </p>
              <FormField
                control={form.control}
                name="invoice_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business name on invoice</FormLabel>
                    <FormControl>
                      <Input placeholder="Quick Truck Lube" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hst_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HST / GST number</FormLabel>
                      <FormControl>
                        <Input placeholder="84754-0960 RT 001" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fax</FormLabel>
                      <FormControl>
                        <Input placeholder="519-622-2493" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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
                {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
