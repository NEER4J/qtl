"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { upsertStatutoryRate } from "@/lib/actions/pricing";
import type { StatutoryRate, StatutoryRateType } from "@/lib/db/types";

interface Form {
  year: number;
  type: StatutoryRateType;
  rate: number;
  annual_max_insurable: number | null;
  annual_max_pensionable: number | null;
  annual_max_pensionable2: number | null;
  basic_exemption: number | null;
}

export function StatutoryRateDialog({
  existing,
  children,
}: {
  existing?: StatutoryRate;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const form = useForm<Form>({
    defaultValues: existing
      ? {
          year: existing.year,
          type: existing.type,
          rate: Number(existing.rate),
          annual_max_insurable: existing.annual_max_insurable,
          annual_max_pensionable: existing.annual_max_pensionable,
          annual_max_pensionable2: existing.annual_max_pensionable2,
          basic_exemption: existing.basic_exemption,
        }
      : {
          year: new Date().getFullYear(),
          type: "ei_employee",
          rate: 0,
          annual_max_insurable: null,
          annual_max_pensionable: null,
          annual_max_pensionable2: null,
          basic_exemption: null,
        },
  });

  async function onSubmit(values: Form) {
    const result = await upsertStatutoryRate({
      year: values.year,
      type: values.type,
      rate: values.rate,
      annual_max_insurable: values.annual_max_insurable,
      annual_max_pensionable: values.annual_max_pensionable,
      annual_max_pensionable2: values.annual_max_pensionable2,
      basic_exemption: values.basic_exemption,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Saved");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Statutory rate</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl><Input type="number" min="2020" max="2100" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!!existing}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ei_employee">EI (employee)</SelectItem>
                        <SelectItem value="ei_employer_multiplier">EI (employer multiplier)</SelectItem>
                        <SelectItem value="cpp_employee">CPP (employee)</SelectItem>
                        <SelectItem value="cpp2_employee">CPP2 (employee)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate (decimal, e.g. 0.0166)</FormLabel>
                  <FormControl><Input type="number" step="0.000001" min="0" max="2" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="annual_max_insurable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max insurable</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="annual_max_pensionable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max pensionable</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="annual_max_pensionable2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max pensionable (tier 2)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="basic_exemption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Basic exemption</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
