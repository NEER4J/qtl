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
import { createIpRule, updateIpRule } from "@/lib/actions/ip-access";
import { describeCidrScope, formatCidr, normalizeCidr } from "@/lib/security/cidr";
import type { IpAllowlistEntryWithLocation, Location } from "@/lib/db/types";

type Mode = "create" | "edit";

// The zod schema for this form transforms `network` into canonical CIDR, so it
// isn't usable as a resolver against the raw form values. Validation therefore
// happens server-side (single source of truth) and we mirror only the CIDR
// check here for a live preview.
interface FormValues {
  label: string;
  network: string;
  location_id: string;
  note: string;
}

const ALL_LOCATIONS = "__all__";

const EMPTY: FormValues = { label: "", network: "", location_id: ALL_LOCATIONS, note: "" };

export function IpRuleFormDialog({
  open,
  onOpenChange,
  mode,
  rule,
  locations,
  defaultNetwork,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  rule?: IpAllowlistEntryWithLocation;
  locations: Location[];
  defaultNetwork?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: EMPTY });

  useEffect(() => {
    if (mode === "edit" && rule) {
      form.reset({
        label: rule.label,
        network: formatCidr(rule.network),
        location_id: rule.location_id ?? ALL_LOCATIONS,
        note: rule.note ?? "",
      });
    } else if (mode === "create") {
      form.reset({ ...EMPTY, network: defaultNetwork ?? "" });
    }
  }, [mode, rule, defaultNetwork, form, open]);

  const networkValue = form.watch("network");
  const parsed = networkValue?.trim() ? normalizeCidr(networkValue) : null;

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        label: values.label,
        network: values.network,
        location_id: values.location_id === ALL_LOCATIONS ? null : values.location_id,
        note: values.note,
        active: rule ? rule.active : true,
      };

      const res =
        mode === "create"
          ? await createIpRule(payload)
          : await updateIpRule({ ...payload, id: rule!.id });

      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [key, msgs] of Object.entries(res.fieldErrors)) {
            form.setError(key as keyof FormValues, { message: msgs[0] });
          }
        }
        return;
      }
      toast.success(mode === "create" ? `Added ${res.data.label}` : `Updated ${res.data.label}`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add approved address" : "Edit approved address"}
          </DialogTitle>
          <DialogDescription>
            Anyone connecting from this address will be able to use the platform
            while the IP lock is on.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Ayr shop office" {...field} />
                  </FormControl>
                  <FormDescription>
                    Something you&apos;ll recognise later, e.g. the shop or the
                    person this address belongs to.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="network"
              rules={{
                required: "Enter an IP address or range",
                validate: (v) => {
                  const result = normalizeCidr(v);
                  return result.ok ? true : result.error;
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP address or range</FormLabel>
                  <FormControl>
                    <Input placeholder="203.0.113.7" className="font-mono" {...field} />
                  </FormControl>
                  <FormDescription>
                    One address (<code>203.0.113.7</code>) or a whole network in
                    CIDR form (<code>203.0.113.0/24</code>).
                    {parsed?.ok ? (
                      <>
                        {" "}
                        Stored as <code>{parsed.value}</code> —{" "}
                        {describeCidrScope(parsed.value).toLowerCase()}.
                      </>
                    ) : null}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="All locations" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ALL_LOCATIONS}>All locations</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Bookkeeping only — it records which shop the address belongs
                    to. Access itself isn&apos;t restricted by location.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Input placeholder="Static IP from Bell, added Jul 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isPending ? "Saving…" : mode === "create" ? "Add" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
