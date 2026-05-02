"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { UppercaseInput } from "@/components/ui/uppercase-input";
import {
  createVehicle,
  getVehicleStats,
  markVehicleContacted,
  updateVehicle,
  type VehicleStats,
} from "@/lib/actions/vehicles";
import { CreateVehicleInput } from "@/lib/schemas/vehicles";
import type { Vehicle } from "@/lib/db/types";
import { formatDate, formatMoney } from "@/lib/utils/format";

/** Same shape as CreateVehicleInput minus customer_id — used for staged
 *  vehicles that are queued before the parent customer exists. */
export type StagedVehicleInput = Omit<
  ReturnType<typeof CreateVehicleInput.parse>,
  "customer_id"
>;

type FormValues = {
  license_plate: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  engine_size: string;
  engine_serial: string;
  unit_number: string;
  cab_card_number: string;
  drive_clean_date: string;
  colour: string;
  expiry_date: string;
  license_renewal_date: string;
  follow_up_date: string;
  mileage: string;
  carrier_name: string;
  comments: string;
  printed_comments: string;
  vehicle_comments: string;
};

const initial: FormValues = {
  license_plate: "",
  vin: "",
  year: "",
  make: "",
  model: "",
  engine_size: "",
  engine_serial: "",
  unit_number: "",
  cab_card_number: "",
  drive_clean_date: "",
  colour: "",
  expiry_date: "",
  license_renewal_date: "",
  follow_up_date: "",
  mileage: "",
  carrier_name: "",
  comments: "",
  printed_comments: "",
  vehicle_comments: "",
};

export function VehicleForm({
  customerId,
  vehicle,
  initialStaged,
  onSaved,
  onStaged,
  onCancel,
}: {
  /** Required in live (DB) mode. Optional / unused in staged mode. */
  customerId?: string;
  /** Editing an existing DB row. */
  vehicle?: Vehicle;
  /** Editing a not-yet-saved row (staged in parent state). */
  initialStaged?: StagedVehicleInput;
  /** Called after a successful DB save (live mode). */
  onSaved?: (vehicle: Vehicle) => void;
  /** Called with parsed values; nothing is written to DB (staged mode). */
  onStaged?: (values: StagedVehicleInput) => void;
  /** Override the default Cancel = router.back(). */
  onCancel?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState<VehicleStats | null>(null);
  const [lastContactedAt, setLastContactedAt] = useState<string | null>(
    vehicle?.last_contacted_at ?? null,
  );
  const router = useRouter();

  // Pull stats when editing an existing vehicle.
  useEffect(() => {
    if (!vehicle) return;
    getVehicleStats(vehicle.id).then(setStats);
  }, [vehicle]);

  const onMarkContacted = () => {
    if (!vehicle) return;
    startTransition(async () => {
      const res = await markVehicleContacted({ id: vehicle.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Marked as contacted");
      setLastContactedAt(res.data.last_contacted_at);
    });
  };

  const form = useForm<FormValues>({
    defaultValues: vehicle
      ? {
          license_plate: vehicle.license_plate,
          vin: vehicle.vin ?? "",
          year: vehicle.year?.toString() ?? "",
          make: vehicle.make ?? "",
          model: vehicle.model ?? "",
          engine_size: vehicle.engine_size ?? "",
          engine_serial: vehicle.engine_serial ?? "",
          unit_number: vehicle.unit_number ?? "",
          cab_card_number: vehicle.cab_card_number ?? "",
          drive_clean_date: vehicle.drive_clean_date ?? "",
          colour: vehicle.colour ?? "",
          expiry_date: vehicle.expiry_date ?? "",
          license_renewal_date: vehicle.license_renewal_date ?? "",
          follow_up_date: vehicle.follow_up_date ?? "",
          mileage: vehicle.mileage?.toString() ?? "",
          carrier_name: vehicle.carrier_name ?? "",
          comments: vehicle.comments ?? "",
          printed_comments: vehicle.printed_comments ?? "",
          vehicle_comments: vehicle.vehicle_comments ?? "",
        }
      : initialStaged
        ? {
            license_plate: initialStaged.license_plate ?? "",
            vin: initialStaged.vin ?? "",
            year: initialStaged.year != null ? String(initialStaged.year) : "",
            make: initialStaged.make ?? "",
            model: initialStaged.model ?? "",
            engine_size: initialStaged.engine_size ?? "",
            engine_serial: initialStaged.engine_serial ?? "",
            unit_number: initialStaged.unit_number ?? "",
            cab_card_number: initialStaged.cab_card_number ?? "",
            drive_clean_date: initialStaged.drive_clean_date ?? "",
            colour: initialStaged.colour ?? "",
            expiry_date: initialStaged.expiry_date ?? "",
            license_renewal_date: initialStaged.license_renewal_date ?? "",
            follow_up_date: initialStaged.follow_up_date ?? "",
            mileage:
              initialStaged.mileage != null ? String(initialStaged.mileage) : "",
            carrier_name: initialStaged.carrier_name ?? "",
            comments: initialStaged.comments ?? "",
            printed_comments: initialStaged.printed_comments ?? "",
            vehicle_comments: initialStaged.vehicle_comments ?? "",
          }
        : initial,
  });

  const isStaging = !!onStaged;

  const onSubmit = form.handleSubmit((values) => {
    const baseFields = {
      license_plate: values.license_plate,
      vin: values.vin || null,
      year: values.year ? Number(values.year) : null,
      make: values.make || null,
      model: values.model || null,
      engine_size: values.engine_size || null,
      engine_serial: values.engine_serial || null,
      unit_number: values.unit_number || null,
      cab_card_number: values.cab_card_number || null,
      drive_clean_date: values.drive_clean_date || null,
      colour: values.colour || null,
      expiry_date: values.expiry_date || null,
      license_renewal_date: values.license_renewal_date || null,
      follow_up_date: values.follow_up_date || null,
      mileage: values.mileage ? Number(values.mileage) : null,
      carrier_name: values.carrier_name || null,
      comments: values.comments || null,
      printed_comments: values.printed_comments || null,
      vehicle_comments: values.vehicle_comments || null,
    };

    // Staged mode — don't write to DB, hand the parsed values back to the
    // parent so it can batch-create them once the customer exists.
    if (isStaging) {
      const stagedSchema = CreateVehicleInput.omit({ customer_id: true });
      const parsed = stagedSchema.safeParse(baseFields);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const path = issue.path[issue.path.length - 1]?.toString();
          if (path) form.setError(path as keyof FormValues, { message: issue.message });
        }
        return;
      }
      onStaged!(parsed.data);
      return;
    }

    // Live mode — write directly to DB. customerId is required.
    if (!customerId) {
      toast.error("Customer ID is missing.");
      return;
    }
    const payload = { customer_id: customerId, ...baseFields };
    const parsed = CreateVehicleInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[issue.path.length - 1]?.toString();
        if (path) form.setError(path as keyof FormValues, { message: issue.message });
      }
      return;
    }

    startTransition(async () => {
      const res = vehicle
        ? await updateVehicle({ ...parsed.data, id: vehicle.id })
        : await createVehicle(parsed.data);

      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, msgs] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: msgs[0] });
          }
        }
        return;
      }
      toast.success(vehicle ? "Vehicle updated" : "Vehicle added");
      if (onSaved) {
        onSaved(res.data);
      } else {
        router.push(`/customers/${customerId}`);
        router.refresh();
      }
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Vehicle stats panel — matches CARS top-right info box on the
            Vehicle screen. Shown only when editing an existing vehicle. */}
        {vehicle && stats && (
          <section className="rounded-md border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                Vehicle stats
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onMarkContacted}
                disabled={isPending}
              >
                <Phone className="size-4" />
                {lastContactedAt
                  ? `Contacted ${formatDate(lastContactedAt)}`
                  : "Mark contacted"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-6">
              <Stat
                label="Last visit"
                value={stats.last_visit_date ? formatDate(stats.last_visit_date) : "—"}
              />
              <Stat label="# visits" value={String(stats.visit_count)} />
              <Stat
                label="Yearly cost (excl. tax)"
                value={formatMoney(stats.total_cost_excl_tax)}
              />
              <Stat
                label="Avg mileage"
                value={
                  stats.avg_km_per_day != null
                    ? `${stats.avg_km_per_day.toFixed(1)} km/day`
                    : "—"
                }
              />
              <Stat
                label="Cost per km"
                value={
                  stats.cost_per_km != null
                    ? `$${stats.cost_per_km.toFixed(2)}`
                    : "—"
                }
              />
              <Stat
                label="Cost per month"
                value={
                  stats.cost_per_month != null
                    ? formatMoney(stats.cost_per_month)
                    : "—"
                }
              />
            </div>
          </section>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          <FormField
            control={form.control}
            name="license_plate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License plate *</FormLabel>
                <FormControl><UppercaseInput maxLength={15} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vin"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>VIN</FormLabel>
                <FormControl><UppercaseInput maxLength={40} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <FormControl><Input type="number" min={1900} max={2100} {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <FormControl><UppercaseInput {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl><UppercaseInput {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="engine_size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Engine size</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="colour"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Colour</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="engine_serial"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Engine serial #</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit number</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mileage</FormLabel>
                <FormControl><Input type="number" min={0} {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="carrier_name"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Carrier</FormLabel>
                <FormControl><Input placeholder="e.g. SOMA Transport" {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cab_card_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CAB card #</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="drive_clean_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drive Clean</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expiry_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expiry</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="license_renewal_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License renewal</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="follow_up_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Follow-up</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
              </FormItem>
            )}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <FormField
            control={form.control}
            name="comments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comments</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="printed_comments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Printed comments (invoice)</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vehicle_comments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Internal notes</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )}
          />
        </section>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : router.back())}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Saving…"
              : vehicle
                ? "Save vehicle"
                : initialStaged
                  ? "Update vehicle"
                  : "Add vehicle"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}
