"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TimeField12h } from "@/components/ui/time-field-12h";
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
import { createCustomer, getCustomer } from "@/lib/actions/customers";
import { excelOilLabel } from "@/lib/utils/oil-labels";
import { getCustomerVehicles } from "@/lib/actions/vehicles";
import { isFreeGreaseEligible } from "@/lib/utils/free-grease";
import { isFreeOilChangeEligible } from "@/lib/utils/free-oil-change";
import { lookupOilChangePrice } from "@/lib/actions/pricing";
import { SalesJobInput } from "@/lib/schemas/sales";
import type {
  Customer,
  EngineType,
  Location,
  OilType,
  PaymentMode,
  ServiceCost,
  ServiceType,
  Technician,
  Vehicle,
} from "@/lib/db/types";
import { todayISO, formatDate } from "@/lib/utils/format";
import { formatPhone } from "@/lib/utils/phone";
import { CreatableCombobox } from "@/components/pricing/creatable-combobox";

import { CustomerComboBox } from "./customer-combobox";
import { PreviousPendingAlert } from "./previous-pending-alert";
import {
  SalesLineItems,
  lineItemsSubTotal,
  lineItemsTaxableSubTotal,
  newLineItem,
  type LineItem,
} from "./sales-line-items";

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
  start_time: string;
  end_time: string;
  bay_no: string;
  upper_tech: string;
  lower_tech: string;
  invoice_no: string;
  customer_id: string | null;
  vehicle_id: string | null;
  billing_name: string;
  billing_address: string;
  business_phone: string;
  alt_phone: string;
  customer_order_no: string;
  unit_no: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vin: string;
  engine_size: string;
  license_plate: string;
  contact_no: string;
  email: string;
  odometer: string;
  service_type_id: string;
  advisor_name: string;
  free_grease_applied: boolean;
  free_grease_override_reason: string;
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
  /** Active roster used to populate Upper tech / Lower tech / Advisor pickers. */
  technicians: Technician[];
  /** Service (labour) costs catalogue — pickable as job line items. */
  serviceCosts?: ServiceCost[];
  hstRate: number;
  /** Force location to this value (staff role). */
  lockedLocationId?: string | null;
  /** Existing line items (edit mode). */
  initialItems?: LineItem[];
}

/** Description for the $0 line item that represents the free-grease offer. */
const FREE_GREASE_LINE_DESC = "Free Grease (offer)";

/** A line is the free-grease offer line when it's a non-catalog $0 row with our label. */
function isFreeGreaseLine(it: LineItem): boolean {
  return it.part_id == null && it.description === FREE_GREASE_LINE_DESC;
}

export function SalesJobForm({
  mode,
  initial,
  locations,
  serviceTypes,
  engineTypes,
  oilTypes,
  technicians,
  serviceCosts = [],
  hstRate,
  lockedLocationId,
  initialItems,
}: SalesJobFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  // Track the last auto-filled price so we can detect manual overrides on submit.
  const [lastAutoPrice, setLastAutoPrice] = useState<string | null>(
    initial?.auto_priced_at && initial?.sub_total ? initial.sub_total : null,
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(initialItems ?? []);
  // Create-mode multi-payment ledger. Each row becomes a sales_payments
  // insert at save time. Edit mode uses the existing AddPaymentDialog on the
  // detail page instead — we don't try to round-trip the ledger through this
  // form (too easy to clobber existing payments).
  const [createPayments, setCreatePayments] = useState<
    { id: string; mode: PaymentMode; amount: string }[]
  >([]);

  // Roster suggestions for the tech/advisor pickers. We expose every active
  // name in every dropdown so the user has flexibility (a Front Counter
  // person can still be tagged on a job if they helped). The combobox is
  // creatable — typing a brand-new name commits it on this job; managing the
  // canonical roster happens at /settings/technicians.
  const technicianSuggestions = technicians.map((t) => t.name);
  const technicianRoleByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of technicians) if (t.role) m.set(t.name, t.role);
    return m;
  }, [technicians]);
  const technicianRoleFor = (name: string) => technicianRoleByName.get(name) ?? null;

  const defaults: FormValues = {
    location_id: lockedLocationId ?? initial?.location_id ?? locations[0]?.id ?? "",
    job_date: initial?.job_date ?? todayISO(),
    start_time: initial?.start_time ?? "",
    end_time: initial?.end_time ?? "",
    bay_no: initial?.bay_no ?? "",
    upper_tech: initial?.upper_tech ?? "",
    lower_tech: initial?.lower_tech ?? "",
    invoice_no: initial?.invoice_no ?? "",
    customer_id: initial?.customer_id ?? null,
    vehicle_id: initial?.vehicle_id ?? null,
    billing_name: initial?.billing_name ?? "",
    billing_address: initial?.billing_address ?? "",
    business_phone: initial?.business_phone ?? "",
    alt_phone: initial?.alt_phone ?? "",
    customer_order_no: initial?.customer_order_no ?? "",
    unit_no: initial?.unit_no ?? "",
    vehicle_year: initial?.vehicle_year ?? "",
    vehicle_make: initial?.vehicle_make ?? "",
    vehicle_model: initial?.vehicle_model ?? "",
    vin: initial?.vin ?? "",
    engine_size: initial?.engine_size ?? "",
    license_plate: initial?.license_plate ?? "",
    contact_no: initial?.contact_no ?? "",
    email: initial?.email ?? "",
    odometer: initial?.odometer ?? "",
    service_type_id: initial?.service_type_id ?? serviceTypes[0]?.id ?? "",
    advisor_name: initial?.advisor_name ?? "",
    free_grease_applied: initial?.free_grease_applied ?? false,
    free_grease_override_reason: initial?.free_grease_override_reason ?? "",
    comments: initial?.comments ?? "",
    sub_total: initial?.sub_total ?? "",
    hst: initial?.hst ?? "",
    total: initial?.total ?? "",
    paid_amount: initial?.paid_amount ?? "",
    payment_mode: initial?.payment_mode ?? "oc",
    engine_type_id: initial?.engine_type_id ?? "",
    oil_type_id: initial?.oil_type_id ?? "",
    oil_container: initial?.oil_container ?? "",
  };

  const form = useForm<FormValues>({ defaultValues: defaults });

  // --------------------------------------------------------------------------
  // Line items drive sub_total whenever there is at least one row.
  // --------------------------------------------------------------------------
  const itemsHaveRows = lineItems.length > 0;
  useEffect(() => {
    if (!itemsHaveRows) return;
    const sum = lineItemsSubTotal(lineItems);
    form.setValue("sub_total", sum.toFixed(2), { shouldDirty: true });
    // Items take over: any prior auto-priced flag no longer applies.
    setLastAutoPrice(null);
  }, [lineItems, itemsHaveRows, form]);

  // --------------------------------------------------------------------------
  // Live total computation: sub_total → hst + total
  // When line items exist, HST is computed only on the taxable subset; without
  // items (e.g. catalog-priced oil change), the whole sub_total is taxable.
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
    const taxableBase = itemsHaveRows ? lineItemsTaxableSubTotal(lineItems) : n;
    const hst = Math.round(taxableBase * hstRate * 100) / 100;
    const total = Math.round((n + hst) * 100) / 100;
    form.setValue("hst", hst.toFixed(2));
    form.setValue("total", total.toFixed(2));
  }, [subTotalRaw, hstRate, form, itemsHaveRows, lineItems]);

  // --------------------------------------------------------------------------
  // Oil-change auto-pricing: when service_type is OC and engine + oil + container
  // are all set, look up the catalog price and pre-fill sub_total.
  // --------------------------------------------------------------------------
  const serviceTypeId = useWatch({ control: form.control, name: "service_type_id" });
  const engineTypeId = useWatch({ control: form.control, name: "engine_type_id" });
  const oilTypeId = useWatch({ control: form.control, name: "oil_type_id" });
  const oilContainer = useWatch({ control: form.control, name: "oil_container" });

  // Advisor picker is filtered by the job's location (client 2026-06): show only
  // technicians whose home location matches, plus any left unassigned (null).
  // Upper/Lower tech pickers stay unfiltered (use technicianSuggestions).
  const selectedLocationId = useWatch({ control: form.control, name: "location_id" });
  const advisorSuggestions = useMemo(
    () =>
      technicians
        .filter((t) => t.location_id == null || t.location_id === selectedLocationId)
        .map((t) => t.name),
    [technicians, selectedLocationId],
  );

  const isOilChange = serviceTypes.find((s) => s.id === serviceTypeId)?.code === "OC";

  useEffect(() => {
    if (!isOilChange) return;
    if (itemsHaveRows) return;
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
  }, [isOilChange, itemsHaveRows, engineTypeId, oilTypeId, oilContainer, form]);

  // --------------------------------------------------------------------------
  // Customer picker sync — billing_name, plate, contact, email auto-fill
  // --------------------------------------------------------------------------
  const customerId = useWatch({ control: form.control, name: "customer_id" });

  // Hydrate selectedCustomer + vehicles when the form mounts with a
  // customer_id already in `initial` — covers both edit mode AND the
  // "Save & add new job" flow that pre-fills customer_id via querystring.
  useEffect(() => {
    if (initial?.customer_id && !selectedCustomer) {
      (async () => {
        const [c, vs] = await Promise.all([
          getCustomer(initial.customer_id!),
          getCustomerVehicles(initial.customer_id!),
        ]);
        if (c) {
          setSelectedCustomer(c);
          // In create mode the form's billing/contact fields default to "" —
          // populate them from the customer so the user doesn't have to retype.
          if (mode === "create") {
            form.setValue("billing_name", c.billing_name ?? c.last_or_company ?? "");
            form.setValue("contact_no", c.phone_cell ?? c.contact_no ?? "");
            form.setValue("email", c.email ?? "");
          }
        }
        setCustomerVehicles(vs);
        if (initial.vehicle_id) {
          const v = vs.find((x) => x.id === initial.vehicle_id) ?? null;
          setSelectedVehicle(v);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyVehicle = (v: Vehicle | null) => {
    setSelectedVehicle(v);
    form.setValue("vehicle_id", v?.id ?? null);
    form.setValue("license_plate", v?.license_plate ?? "");
    form.setValue("vin", v?.vin ?? "");
    form.setValue("vehicle_year", v?.year != null ? String(v.year) : "");
    form.setValue("vehicle_make", v?.make ?? "");
    form.setValue("vehicle_model", v?.model ?? "");
    form.setValue("engine_size", v?.engine_size ?? "");
    form.setValue("unit_no", v?.unit_number ?? "");
    if (v?.mileage != null) form.setValue("odometer", String(v.mileage));
  };

  const applyCustomer = async (c: Customer) => {
    setSelectedCustomer(c);
    setAddingNewCustomer(false);
    form.setValue("customer_id", c.id);
    form.setValue(
      "billing_name",
      c.billing_name ?? c.last_or_company ?? "",
    );
    form.setValue("contact_no", formatPhone(c.phone_cell ?? c.contact_no));
    form.setValue("email", c.email ?? "");

    // Pull billing address (item #3 — billing options live on customer)
    const addr = [
      c.address_1,
      c.address_2,
      [c.city, c.province].filter(Boolean).join(", "),
      c.postal_code,
    ]
      .filter(Boolean)
      .join("\n");
    form.setValue("billing_address", addr);
    form.setValue("business_phone", formatPhone(c.phone_business));
    form.setValue("alt_phone", formatPhone(c.phone_alt_1 ?? c.phone_home));

    // Pull default pay method
    if (c.default_pay_method) form.setValue("payment_mode", c.default_pay_method);

    // Free grease default — checked when eligible
    form.setValue("free_grease_applied", isFreeGreaseEligible(c));

    // Load vehicles for picker
    const vs = await getCustomerVehicles(c.id);
    setCustomerVehicles(vs);
    if (vs.length === 1) applyVehicle(vs[0]);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setAddingNewCustomer(false);
    setCustomerVehicles([]);
    setSelectedVehicle(null);
    form.setValue("customer_id", null);
    form.setValue("vehicle_id", null);
    form.setValue("billing_name", "");
    form.setValue("license_plate", "");
    form.setValue("contact_no", "");
    form.setValue("email", "");
    form.setValue("free_grease_applied", false);
    form.setValue("free_grease_override_reason", "");
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
          last_or_company: values.billing_name.toUpperCase(),
          contact_no: values.contact_no || null,
          email: values.email || null,
          license_plates: platePicked ? [platePicked] : [],
          notes: null,
          country: "CA",
          phone_notes: {},
          cod_required: false,
          labour_discount_pct: 0,
          parts_discount_pct: 0,
          late_payment_pct: 0,
          late_payment_days: 0,
          pays_hst: true,
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
      }

      // Step 2 — validate and submit the sales-job with the (possibly
      // just-created) customer id.
      const stillAutoPriced =
        lastAutoPrice != null && Number(values.sub_total) === Number(lastAutoPrice);

      // Multi-payment path (create mode only): roll up the ledger into the
      // initial_payments array the schema/action understand. Empty rows are
      // dropped silently; a single row collapses cleanly to one ledger entry.
      const cleanedPayments =
        mode === "create"
          ? createPayments
              .map((p) => ({ mode: p.mode, amount: Number(p.amount) || 0 }))
              .filter((p) => p.amount > 0)
          : [];

      const payload = {
        ...values,
        customer_id: customerIdToUse,
        vehicle_id: values.vehicle_id ?? null,
        bay_no: values.bay_no === "" ? null : Number(values.bay_no),
        odometer: values.odometer === "" ? null : Number(values.odometer),
        vehicle_year: values.vehicle_year === "" ? null : Number(values.vehicle_year),
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
        initial_payments: cleanedPayments.length > 0 ? cleanedPayments : undefined,
        items: lineItems.map((it) => ({
          part_id: it.part_id,
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          mhsw_unit: Number(it.mhsw_unit) || 0,
          is_taxable: it.is_taxable,
          package_label: it.package_label ?? null,
          package_group: it.package_group ?? null,
          oil_type_id: it.oil_type_id ?? null,
          transmission_service_id: it.transmission_service_id ?? null,
          merged_unit_price: it.merged_unit_price ?? null,
          is_customer_supplied: it.is_customer_supplied ?? false,
        })),
      };

      const parsed = SalesJobInput.safeParse(payload);
      if (!parsed.success) {
        // Some fields aren't always rendered (e.g. billing_name when no
        // customer is picked; items.* live outside react-hook-form). Surface
        // those via toast so the click doesn't feel silently dropped.
        const REGISTERED: ReadonlySet<string> = new Set([
          "location_id", "job_date", "start_time", "end_time", "bay_no", "upper_tech", "lower_tech",
          "invoice_no", "billing_name", "license_plate", "contact_no", "email",
          "odometer", "service_type_id", "advisor_name",
          "comments", "sub_total", "hst", "total", "paid_amount", "payment_mode",
          "free_grease_applied", "free_grease_override_reason",
          "engine_type_id", "oil_type_id", "oil_container",
        ]);
        const stray: string[] = [];
        for (const issue of parsed.error.issues) {
          const path = issue.path.join(".");
          const top = String(issue.path[0] ?? "");
          if (REGISTERED.has(top) && (selectedCustomer || addingNewCustomer || top !== "billing_name")) {
            form.setError(path as keyof FormValues, { message: issue.message });
          } else if (top === "billing_name") {
            stray.push("Pick a customer or add a new one before saving.");
          } else if (top === "items") {
            stray.push(`Line item ${Number(issue.path[1]) + 1}: ${issue.message}`);
          } else {
            stray.push(`${path || "Form"}: ${issue.message}`);
          }
        }
        if (stray.length > 0) toast.error(stray[0], { description: stray.slice(1).join("\n") || undefined });
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

                {/* Vehicle picker (item #4 — multiple trucks) */}
                <FormItem>
                  <FormLabel>Vehicle</FormLabel>
                  <FormControl>
                    {customerVehicles.length === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        This customer has no registered vehicles.{" "}
                        <a
                          href={`/customers/${selectedCustomer.id}/vehicles/new`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Add a vehicle
                        </a>{" "}
                        first, then refresh this page.
                      </div>
                    ) : (
                      <Select
                        value={selectedVehicle?.id ?? ""}
                        onValueChange={(vid) => {
                          const v = customerVehicles.find((x) => x.id === vid) ?? null;
                          applyVehicle(v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                          {customerVehicles.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              <span className="font-mono">{v.license_plate}</span>
                              {v.year || v.make || v.model
                                ? ` — ${[v.year, v.make, v.model].filter(Boolean).join(" ")}`
                                : ""}
                              {v.carrier_name ? ` · ${v.carrier_name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormControl>
                </FormItem>

                {/* Free grease banner — item #15 */}
                {isFreeGreaseEligible(selectedCustomer) && (
                  <FreeGreaseBanner
                    until={selectedCustomer.free_grease_until!}
                    applied={form.watch("free_grease_applied")}
                    overrideReason={form.watch("free_grease_override_reason")}
                    onChangeApplied={(v) => {
                      form.setValue("free_grease_applied", v);
                      // Reflect the offer as a real $0 line item rather than a
                      // hidden flag: the grease shows on the job/invoice, and a
                      // free-only job is a tangible $0 line (not an empty,
                      // bogus-outstanding invoice).
                      setLineItems((prev) => {
                        const without = prev.filter((it) => !isFreeGreaseLine(it));
                        return v
                          ? [
                              ...without,
                              newLineItem({
                                description: FREE_GREASE_LINE_DESC,
                                quantity: 1,
                                unit_price: 0,
                                is_taxable: false,
                              }),
                            ]
                          : without;
                      });
                    }}
                    onChangeReason={(v) => form.setValue("free_grease_override_reason", v)}
                  />
                )}

                {/* Free oil-change banner — item #29. Informational; actual
                    discount application is handled at line-item entry time. */}
                {isFreeOilChangeEligible(selectedCustomer) && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Free oil change available</strong> until{" "}
                    {formatDate(selectedCustomer.free_oil_change_until!)}. When the service is OC,
                    set the oil-change line price to zero to apply the offer.
                  </div>
                )}
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
                        <Input {...field} placeholder="Customer or company name" />
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
                          <Input {...field} placeholder="Phone number" />
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
                          <Input type="email" {...field} placeholder="Email address" />
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
                          placeholder="License plate"
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
               Step 1b — Bill-to & vehicle summary (auto-filled from selection)
               These fields snapshot onto the invoice. Edit billing on the
               customer page; edit vehicle specs on the customer's vehicle.
          ---------------------------------------------------------------- */}
          {(selectedCustomer || selectedVehicle) && (
            <section className="rounded-md border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                  Invoice snapshot
                </h2>
                <span className="text-xs text-muted-foreground">
                  Auto-filled from customer + vehicle. Edit on the source record.
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Bill-to
                  </div>
                  <div className="whitespace-pre-line rounded-md border bg-background px-3 py-2 text-sm">
                    {form.watch("billing_address") || (
                      <span className="text-muted-foreground">No address on file.</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <ReadField label="Business phone" value={form.watch("business_phone")} />
                  <ReadField label="Other phone" value={form.watch("alt_phone")} />
                  <ReadField label="Unit no." value={form.watch("unit_no")} />
                  <ReadField label="Year" value={form.watch("vehicle_year")} />
                  <ReadField label="Make" value={form.watch("vehicle_make")} />
                  <ReadField label="Model" value={form.watch("vehicle_model")} />
                  <ReadField label="VIN" value={form.watch("vin")} mono />
                  <ReadField label="Engine size" value={form.watch("engine_size")} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="customer_order_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer order # (this job)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>
          )}

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
                        Whatever you write on the paper invoice. It has to be unique within this shop — you can&apos;t reuse an invoice number you&apos;ve used before at the same location. Leave blank to auto-generate (e.g. AYR202605250001 — location code + date + monthly counter).
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
                name="advisor_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Advisor</FormLabel>
                    <FormControl>
                      <CreatableCombobox
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        suggestions={advisorSuggestions}
                        descriptionFor={technicianRoleFor}
                        placeholder="Pick advisor"
                        searchPlaceholder="Search by name or role…"
                        emptyLabel="No advisors at this location."
                        addLabel="Add"
                        allowClear
                      />
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
                                {excelOilLabel(o.code, o.name)}{" "}
                                <span className="text-muted-foreground">— {o.name}</span>
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
                      <CreatableCombobox
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        suggestions={technicianSuggestions}
                        descriptionFor={technicianRoleFor}
                        placeholder="Pick technician"
                        searchPlaceholder="Search by name or role…"
                        emptyLabel="Roster empty."
                        addLabel="Add"
                        allowClear
                      />
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
                      <CreatableCombobox
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        suggestions={technicianSuggestions}
                        descriptionFor={technicianRoleFor}
                        placeholder="Pick technician"
                        searchPlaceholder="Search by name or role…"
                        emptyLabel="Roster empty."
                        addLabel="Add"
                        allowClear
                      />
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
                    <FormLabel>Start time</FormLabel>
                    <FormControl>
                      <TimeField12h
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
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
                    <FormLabel>End time</FormLabel>
                    <FormControl>
                      <TimeField12h
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <JobDurationHint control={form.control} />

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
               Step 2b — Line items / products
          ---------------------------------------------------------------- */}
          <section className="rounded-md border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Line items
              </h2>
              {itemsHaveRows && (
                <span className="text-xs text-muted-foreground">
                  Sub total is calculated from items below.
                </span>
              )}
            </div>
            <SalesLineItems
              items={lineItems}
              onChange={setLineItems}
              serviceCosts={serviceCosts}
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
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        readOnly={itemsHaveRows}
                        className={itemsHaveRows ? "bg-muted/50" : undefined}
                        {...field}
                      />
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
              {mode === "edit" && (
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
              )}
            </div>

            {mode === "edit" && (
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
            )}

            {/* Multi-payment ledger (create mode). Add one row per tender the
                customer used (e.g. $100 cash + $50 Visa). Each row becomes a
                sales_payments insert at save time. Leave the list empty to
                mark the job Outstanding; further payments are recorded later
                via the Add Payment dialog on the job detail page. */}
            {mode === "create" && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <FormLabel>Payments received</FormLabel>
                  <span className="text-xs text-muted-foreground">
                    Add a row for each tender (cash + card splits are fine).
                  </span>
                </div>

                {createPayments.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No payment yet — this job will be marked Outstanding.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {createPayments.map((row, idx) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[minmax(0,160px)_1fr_auto] gap-2 items-end"
                      >
                        <div>
                          {idx === 0 && (
                            <div className="text-xs text-muted-foreground mb-1">Mode</div>
                          )}
                          <Select
                            value={row.mode}
                            onValueChange={(v) =>
                              setCreatePayments((prev) =>
                                prev.map((p) =>
                                  p.id === row.id ? { ...p, mode: v as PaymentMode } : p,
                                ),
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_MODES.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          {idx === 0 && (
                            <div className="text-xs text-muted-foreground mb-1">Amount</div>
                          )}
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e) =>
                              setCreatePayments((prev) =>
                                prev.map((p) =>
                                  p.id === row.id ? { ...p, amount: e.target.value } : p,
                                ),
                              )
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setCreatePayments((prev) => prev.filter((p) => p.id !== row.id))
                          }
                          aria-label="Remove payment"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const remaining =
                        Number(form.getValues("total") || 0) -
                        createPayments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
                      setCreatePayments((prev) => [
                        ...prev,
                        {
                          id:
                            typeof crypto !== "undefined" && "randomUUID" in crypto
                              ? crypto.randomUUID()
                              : `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                          mode: "cash",
                          amount: remaining > 0 ? remaining.toFixed(2) : "",
                        },
                      ]);
                    }}
                  >
                    <Plus className="size-4" /> Add payment
                  </Button>
                  {createPayments.length > 0 && (
                    <div className="text-xs text-muted-foreground tabular-nums">
                      Total paid:{" "}
                      <span className="font-medium text-foreground">
                        $
                        {createPayments
                          .reduce((a, p) => a + (Number(p.amount) || 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mode === "edit" && Number(paidRaw) === 0 && (
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
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}

function ReadField({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 text-xs text-muted-foreground">{label}</div>
      <div
        className={`min-h-9 rounded-md border bg-background px-2 py-1.5 text-sm ${mono ? "font-mono" : ""}`}
      >
        {value && value.length > 0 ? (
          value
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

function FreeGreaseBanner({
  until,
  applied,
  overrideReason,
  onChangeApplied,
  onChangeReason,
}: {
  until: string;
  applied: boolean;
  overrideReason: string;
  onChangeApplied: (v: boolean) => void;
  onChangeReason: (v: string) => void;
}) {
  return (
    <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
      <div className="flex items-start gap-3">
        <Checkbox
          id="free_grease_applied"
          checked={applied}
          onCheckedChange={(v) => onChangeApplied(Boolean(v))}
          className="mt-0.5"
        />
        <div className="flex-1">
          <label htmlFor="free_grease_applied" className="block cursor-pointer text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Apply free-grease offer (eligible until {formatDate(until)})
          </label>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/70">
            Customer is in their first 30 days. When applied, the grease line is invoiced at $0.
            If you uncheck, leave a quick reason so the override is auditable.
          </p>
          {!applied && (
            <Textarea
              rows={2}
              value={overrideReason}
              onChange={(e) => onChangeReason(e.target.value)}
              placeholder="Reason for not applying (e.g. customer declined, offer already redeemed)"
              className="mt-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Live "Duration: 1h 23m" hint under the start/end inputs.
function JobDurationHint({ control }: { control: ReturnType<typeof useForm<FormValues>>["control"] }) {
  const start = useWatch({ control, name: "start_time" });
  const end = useWatch({ control, name: "end_time" });
  const minutes = diffMinutes(start, end);
  if (minutes == null) return null;
  if (minutes < 0) {
    return <p className="text-xs text-destructive">End time is before start time.</p>;
  }
  return (
    <p className="text-xs text-muted-foreground">
      Duration: {formatDuration(minutes)}
    </p>
  );
}

function diffMinutes(start: string | undefined, end: string | undefined): number | null {
  if (!start || !end) return null;
  const s = parseHHmm(start);
  const e = parseHHmm(end);
  if (s == null || e == null) return null;
  return e - s;
}

function parseHHmm(v: string): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
