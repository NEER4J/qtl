"use client";

import { useEffect, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import { CreateCustomerInput } from "@/lib/schemas/customers";
import type { Customer, Location } from "@/lib/db/types";

const ANY_LOCATION = "__any__";

type FormValues = {
  code: string;
  billing_name: string;
  contact_no: string;
  email: string;
  license_plates: { value: string }[];
  home_location_id: string;
  notes: string;
};

export function CustomerFormDialog({
  open,
  onOpenChange,
  mode,
  customer,
  locations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  customer?: Customer;
  locations: Location[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    defaultValues: {
      code: "",
      billing_name: "",
      contact_no: "",
      email: "",
      license_plates: [{ value: "" }],
      home_location_id: "",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "license_plates",
  });

  useEffect(() => {
    if (open) {
      if (mode === "edit" && customer) {
        form.reset({
          code: customer.code ?? "",
          billing_name: customer.billing_name,
          contact_no: customer.contact_no ?? "",
          email: customer.email ?? "",
          license_plates:
            customer.license_plates.length > 0
              ? customer.license_plates.map((p) => ({ value: p }))
              : [{ value: "" }],
          home_location_id: customer.home_location_id ?? ANY_LOCATION,
          notes: customer.notes ?? "",
        });
      } else {
        form.reset({
          code: "",
          billing_name: "",
          contact_no: "",
          email: "",
          license_plates: [{ value: "" }],
          home_location_id: ANY_LOCATION,
          notes: "",
        });
      }
    }
  }, [open, mode, customer, form]);

  const onSubmit = form.handleSubmit((values) => {
    const plates = values.license_plates
      .map((p) => p.value.trim().toUpperCase())
      .filter(Boolean);

    const payload = {
      code: values.code || null,
      billing_name: values.billing_name,
      contact_no: values.contact_no || null,
      email: values.email || null,
      license_plates: plates,
      home_location_id:
        values.home_location_id && values.home_location_id !== ANY_LOCATION
          ? values.home_location_id
          : null,
      notes: values.notes || null,
    };

    const parsed = CreateCustomerInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[issue.path.length - 1]?.toString();
        if (path) form.setError(path as keyof FormValues, { message: issue.message });
      }
      return;
    }

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createCustomer(parsed.data)
          : await updateCustomer({ ...parsed.data, id: customer!.id });

      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, msgs] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: msgs[0] });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Customer created" : "Customer updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New customer" : "Edit customer"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new customer record."
              : "Update customer details."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer code</FormLabel>
                  <FormControl>
                    <Input placeholder="Auto-generated if blank" className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billing_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Trucking Ltd." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
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
                      <Input type="email" placeholder="fleet@acme.ca" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <FormLabel>License plates</FormLabel>
              <div className="mt-1.5 space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <Input
                      placeholder="ABC 1234"
                      {...form.register(`license_plates.${index}.value`)}
                      className="uppercase"
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ value: "" })}
                >
                  <Plus className="size-4" /> Add plate
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="home_location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Home location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Any location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ANY_LOCATION}>Any location</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
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
