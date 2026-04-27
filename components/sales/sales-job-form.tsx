"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyDropdownHint } from "@/components/help/empty-state";
import { InfoTip } from "@/components/help/info-tip";
import { createSalesJob, updateSalesJob } from "@/lib/actions/sales";
import { createCustomer, getCustomer, updateCustomer } from "@/lib/actions/customers";
import { lookupOilChangePrice } from "@/lib/actions/pricing";
import { SalesJobInput } from "@/lib/schemas/sales";
import type { Customer, EngineType, Location, OilType, PaymentMode, ServiceType } from "@/lib/db/types";
import { todayISO } from "@/lib/utils/format";

import { CustomerComboBox } from "./customer-combobox";
import { PlateComboBox } from "./plate-combobox";
import { PreviousPendingAlert } from "./previous-pending-alert";

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "debit", label: "Debit" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "etransfer", label: "E-Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "oc", label: "OC (Outstanding)" },
];

// Form values use strings for numeric inputs (html date/number/text) and
// only get coerced + validated at submit time via the shared zod schema.
interface FormValues {
  location_id: string;
  job_date: string;
  bay_no: string;
  upper_tech: string;
  lower_tech: string;
  invoice_no: string;
  customer_id: string | null;
  billing_name: string;
  license_plate: string;
  contact_no: string;
  email: string;
  odometer: string;
  service_type_id: string;
  carrier_name: string;
  start_time: string;
  end_time: string;
  comments: string;
  sub_total: string;
  hst: string;
  total: string;
  paid_amount: string;
  payment_mode: PaymentMode | "";
  engine_type_id: string;
  oil_type_id: string;
  oil_container: "bulk" | "gallon" | "";
}

export interface SalesJobFormProps {
  mode: "create" | "edit";
  initial?: Partial<FormValues> & { id?: string; auto_priced_at?: string | null };
  locations: Location[];
  serviceTypes: ServiceType[];
  engineTypes: EngineType[];
  oilTypes: OilType[];
  hstRate: number;
  /** Force location to this value (staff role). */
  lockedLocationId?: string | null;
}

export function SalesJobForm({
  mode,
  initial,
  locations,
  serviceTypes,
  engineTypes,
  oilTypes,
  hstRate,
  lockedLocationId,
}: SalesJobFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  // Track the last auto-filled price so we can detect manual overrides on submit.
  const [lastAutoPrice, setLastAutoPrice] = useState<string | null>(
    initial?.auto_priced_at && initial?.sub_total ? initial.sub_total : null,
  );

  const defaults: FormValues = {
    location_id: lockedLocationId ?? initial?.location_id ?? locations[0]?.id ?? "",
    job_date: initial?.job_date ?? todayISO(),
    bay_no: initial?.bay_no ?? "",
    upper_tech: initial?.upper_tech ?? "",
    lower_tech: initial?.lower_tech ?? "",
    invoice_no: initial?.invoice_no ?? "",
    customer_id: initial?.customer_id ?? null,
    billing_name: initial?.billing_name ?? "",
    license_plate: initial?.license_plate ?? "",
    contact_no: initial?.contact_no ?? "",
    email: initial?.email ?? "",
    odometer: initial?.odometer ?? "",
    service_type_id: initial?.service_type_id ?? serviceTypes[0]?.id ?? "",
    carrier_name: initial?.carrier_name ?? "",
    start_time: initial?.start_time ?? "",
    end_time: initial?.end_time ?? "",
    comments: initial?.comments ?? "",
    sub_total: initial?.sub_total ?? "",
    hst: initial?.hst ?? "",
    total: initial?.total ?? "",
    paid_amount: initial?.paid_amount ?? "",
    payment_mode: initial?.payment_mode ?? "",
    engine_type_id: initial?.engine_type_id ?? "",
    oil_type_id: initial?.oil_type_id ?? "",
    oil_container: initial?.oil_container ?? "",
  };

  const form = useForm<FormValues>({ defaultValues: defaults });

  // --------------------------------------------------------------------------
  // Live total computation: sub_total → hst + total
  // --------------------------------------------------------------------------
  const subTotalRaw = useWatch({ control: form.control, name: "sub_total" });
  const paidRaw = useWatch({ control: form.control, name: "paid_amount" });

  useEffect(() => {
    const n = Number(subTotalRaw);
    if (!Number.isFinite(n) || n <= 0) {
      form.setValue("hst", "");
      form.setValue("total", "");
      return;
    }
    const hst = Math.round(n * hstRate * 100) / 100;
    const total = Math.round((n + hst) * 100) / 100;
    form.setValue("hst", hst.toFixed(2));
    form.setValue("total", total.toFixed(2));
  }, [subTotalRaw, hstRate, form]);

  // --------------------------------------------------------------------------
  // Oil-change auto-pricing: when service_type is OC and engine + oil + container
  // are all set, look up the catalog price and pre-fill sub_total.
  // --------------------------------------------------------------------------
  const serviceTypeId = useWatch({ control: form.control, name: "service_type_id" });
  const engineTypeId = useWatch({ control: form.control, name: "engine_type_id" });
  const oilTypeId = useWatch({ control: form.control, name: "oil_type_id" });
  const oilContainer = useWatch({ control: form.control, name: "oil_container" });

  const isOilChange = serviceTypes.find((s) => s.id === serviceTypeId)?.code === "OC";

  useEffect(() => {
    if (!isOilChange) return;
    if (!engineTypeId || !oilTypeId || !oilContainer) return;
    let cancelled = false;
    (async () => {
      const res = await lookupOilChangePrice({
        engine_type_id: engineTypeId,
        oil_type_id: oilTypeId,
        oil_container: oilContainer as "bulk" | "gallon",
      });
      if (cancelled || !res.ok) return;
      if (res.data.sub_total == null) {
        toast.warning("No catalog price found for that engine + oil combo.");
        return;
      }
      const formatted = res.data.sub_total.toFixed(2);
      form.setValue("sub_total", formatted, { shouldDirty: true });
      setLastAutoPrice(formatted);
    })();
    return () => { cancelled = true; };
  }, [isOilChange, engineTypeId, oilTypeId, oilContainer, form]);

  // --------------------------------------------------------------------------
  // Customer picker sync — billing_name, plate, contact, email auto-fill
  // --------------------------------------------------------------------------
  const customerId = useWatch({ control: form.control, name: "customer_id" });

  // Edit mode — hydrate selectedCustomer from the existing customer_id so the
  // read-only card and plate combobox have full data.
  useEffect(() => {
    if (mode === "edit" && initial?.customer_id && !selectedCustomer) {
      (async () => {
        const c = await getCustomer(initial.customer_id!);
        if (c) setSelectedCustomer(c);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setAddingNewCustomer(false);
    form.setValue("customer_id", c.id);
    form.setValue("billing_name", c.billing_name);
    form.setValue(
      "license_plate",
      c.license_plates?.length ? c.license_plates[0] : "",
    );
    form.setValue("contact_no", c.contact_no ?? "");
    form.setValue("email", c.email ?? "");
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setAddingNewCustomer(false);
    form.setValue("customer_id", null);
    form.setValue("billing_name", "");
    form.setValue("license_plate", "");
    form.setValue("contact_no", "");
    form.setValue("email", "");
  };

  const startAddingNewCustomer = (name: string) => {
    setSelectedCustomer(null);
    setAddingNewCustomer(true);
    form.setValue("customer_id", null);
    form.setValue("billing_name", name);
    form.setValue("license_plate", "");
    form.setValue("contact_no", "");
    form.setValue("email", "");
  };

  // --------------------------------------------------------------------------
  // Submit
  // --------------------------------------------------------------------------
  const onSubmit = form.handleSubmit((values) => {
    if (addingNewCustomer && !values.billing_name.trim()) {
      form.setError("billing_name", { message: "Billing name is required" });
      return;
    }

    startTransition(async () => {
      let customerIdToUse = values.customer_id;
      const platePicked = (values.license_plate || "").trim().toUpperCase();

      // Step 1 — create the customer first if we're adding new.
      if (addingNewCustomer) {
        const custRes = await createCustomer({
          billing_name: values.billing_name,
          contact_no: values.contact_no || null,
          email: values.email || null,
          license_plates: platePicked ? [platePicked] : [],
          home_location_id: null,
          notes: null,
        });
        if (!custRes.ok) {
          toast.error(`Couldn't create customer: ${custRes.error}`);
          if (custRes.fieldErrors) {
            for (const [k, v] of Object.entries(custRes.fieldErrors)) {
              form.setError(k as keyof FormValues, { message: v[0] });
            }
          }
          return;
        }
        customerIdToUse = custRes.data.id;
        setSelectedCustomer(custRes.data);
        setAddingNewCustomer(false);
        form.setValue("customer_id", custRes.data.id);
      } else if (
        selectedCustomer &&
        platePicked &&
        !(selectedCustomer.license_plates ?? []).includes(platePicked)
      ) {
        // Step 1b — append a brand-new plate to an existing customer so next
        // time it shows up in the plate combobox.
        const existingPlates = selectedCustomer.license_plates ?? [];
        const updRes = await updateCustomer({
          id: selectedCustomer.id,
          billing_name: selectedCustomer.billing_name,
          contact_no: selectedCustomer.contact_no,
          email: selectedCustomer.email,
          license_plates: [...existingPlates, platePicked],
          home_location_id: selectedCustomer.home_location_id,
          notes: selectedCustomer.notes,
        });
        if (!updRes.ok) {
          toast.error(`Couldn't save new plate: ${updRes.error}`);
          return;
        }
        setSelectedCustomer(updRes.data);
      }

      // Step 2 — validate and submit the sales-job with the (possibly
      // just-created) customer id.
      const stillAutoPriced =
        lastAutoPrice != null && Number(values.sub_total) === Number(lastAutoPrice);

      const payload = {
        ...values,
        customer_id: customerIdToUse,
        bay_no: values.bay_no === "" ? null : Number(values.bay_no),
        odometer: values.odometer === "" ? null : Number(values.odometer),
        sub_total: Number(values.sub_total || 0),
        hst: Number(values.hst || 0),
        total: Number(values.total || 0),
        paid_amount: Number(values.paid_amount || 0),
        payment_mode: values.payment_mode === "" ? null : values.payment_mode,
        start_time: values.start_time || null,
        end_time: values.end_time || null,
        engine_type_id: values.engine_type_id || null,
        oil_type_id: values.oil_type_id || null,
        oil_container: values.oil_container || null,
        auto_priced_at: stillAutoPriced ? new Date().toISOString() : null,
      };

      const parsed = SalesJobInput.safeParse(payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const path = issue.path.join(".");
          form.setError(path as keyof FormValues, { message: issue.message });
        }
        return;
      }

      const res =
        mode === "create"
          ? await createSalesJob(parsed.data)
          : await updateSalesJob({ ...parsed.data, id: initial?.id! });
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: v[0] });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Job created" : "Job updated");
      router.push(`/sales/${res.data.id}`);
      router.refresh();
    });
  });

  const locationOptions = useMemo(
    () => locations.filter((l) => l.active),
    [locations],
  );

  return (
    <>
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* ----------------------------------------------------------------
               Step 1 — Customer
          ---------------------------------------------------------------- */}
          <section className="rounded-md border p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Customer
            </h2>

            {/* Mode 1 — picker (no customer chosen yet, not adding new) */}
            {!selectedCustomer && !addingNewCustomer && (
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Find or add a customer</FormLabel>
                    <FormControl>
                      <CustomerComboBox
                        value={field.value}
                        billingName={form.getValues("billing_name")}
                        onChange={(id) => field.onChange(id)}
                        onSelectCustomer={applyCustomer}
                        onCreateNew={startAddingNewCustomer}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Mode 2 — existing customer selected */}
            {selectedCustomer && !addingNewCustomer && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted/40 border border-dashed px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{selectedCustomer.billing_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                        {selectedCustomer.contact_no && <span>{selectedCustomer.contact_no}</span>}
                        {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a
                        href={`/customers/${selectedCustomer.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Edit
                      </a>
                      <button
                        type="button"
                        onClick={clearCustomer}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                </div>

                <PreviousPendingAlert customerId={customerId ?? null} />

                <FormField
                  control={form.control}
                  name="license_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License plate</FormLabel>
                      <FormControl>
                        <PlateComboBox
                          value={field.value}
                          plates={selectedCustomer.license_plates ?? []}
                          onChange={(plate) => field.onChange(plate)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Mode 3 — adding new customer inline */}
            {addingNewCustomer && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Enter the new customer&apos;s details.
                  </p>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Pick existing instead
                  </button>
                </div>

                <FormField
                  control={form.control}
                  name="billing_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Acme Trucking Ltd." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contact_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(226) 555-0100" />
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
                          <Input type="email" {...field} placeholder="billing@acme.ca" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="license_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License plate</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="font-mono uppercase max-w-xs"
                          placeholder="ABC 1234"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </section>

          {/* ----------------------------------------------------------------
               Step 2 — Job
          ---------------------------------------------------------------- */}
          <section className="rounded-md border p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Job
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="job_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                    {locationOptions.length === 0 ? (
                      <EmptyDropdownHint
                        message="No shop locations have been added yet."
                        actionLabel="Add a location"
                        href="/settings/locations"
                      />
                    ) : (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!!lockedLocationId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locationOptions.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoice_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Invoice #
                      <InfoTip>
                        Whatever you write on the paper invoice. It has to be unique within this shop — you can&apos;t reuse an invoice number you&apos;ve used before at the same location. Leave blank to auto-generate (INV-000001).
                      </InfoTip>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Auto-generated if blank" className="font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bay_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bay</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="service_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service</FormLabel>
                    {serviceTypes.length === 0 ? (
                      <EmptyDropdownHint
                        message="No service types set up yet."
                        actionLabel="Add service types"
                        href="/settings/services"
                      />
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {serviceTypes.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carrier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="odometer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Odometer</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isOilChange && (
              <div className="rounded-md bg-muted/40 border border-dashed p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Catalog auto-pricing
                  </p>
                  {lastAutoPrice && Number(form.getValues("sub_total")) === Number(lastAutoPrice) ? (
                    <span className="text-xs text-emerald-700">
                      Sub total auto-filled — edit to override.
                    </span>
                  ) : lastAutoPrice ? (
                    <span className="text-xs text-amber-700">Manually overridden.</span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="engine_type_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engine</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select engine" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {engineTypes.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.manufacturer} {e.model} ({e.oil_capacity_litres}L)
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
                    name="oil_type_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Oil grade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select oil" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {oilTypes.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.code} — {o.name}
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
                    name="oil_container"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Container</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Bulk or Gallon" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bulk">Bulk (per litre)</SelectItem>
                            <SelectItem value="gallon">Imperial gallon</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="upper_tech"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Upper tech</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lower_tech"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lower tech</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* ----------------------------------------------------------------
               Step 3 — Payment
          ---------------------------------------------------------------- */}
          <section className="rounded-md border p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Payment
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="sub_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub Total</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hst"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      HST ({(hstRate * 100).toFixed(0)}%)
                      <InfoTip>
                        Calculated automatically from the sub total. You can&apos;t edit this field directly — change the sub total and HST updates.
                      </InfoTip>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" readOnly className="bg-muted/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" readOnly className="bg-muted/50 font-semibold" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paid_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_mode"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Payment mode</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v as PaymentMode | "")}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="(Outstanding if blank)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {Number(paidRaw) === 0 && (
              <p className="text-xs text-amber-600">
                No payment recorded — this job will be marked Outstanding.
              </p>
            )}
          </section>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : mode === "create" ? "Create job" : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
