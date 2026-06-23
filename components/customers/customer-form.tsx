"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CountrySelect, ProvinceSelect } from "@/components/ui/country-province-select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneWithNotes } from "@/components/ui/phone-with-notes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UppercaseInput } from "@/components/ui/uppercase-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  checkCustomerNameExists,
  createCustomer,
  updateCustomer,
} from "@/lib/actions/customers";
import {
  createVehicle,
  deactivateVehicle,
  getCustomerVehicles,
} from "@/lib/actions/vehicles";
import { CreateCustomerInput } from "@/lib/schemas/customers";
import { postalPlaceholder } from "@/lib/data/regions";
import type { Customer, Vehicle } from "@/lib/db/types";
import type { StagedVehicleInput } from "@/app/(app)/customers/[id]/vehicles/vehicle-form";

import { VehicleFormDialog } from "./vehicle-form-dialog";

const NO_PAY_METHOD = "__none__";

type FormValues = {
  code: string;
  last_or_company: string;
  card_number: string;
  card_expiry: string;
  card_cvv: string;
  address_1: string;
  address_2: string;
  city: string;
  province: string;
  country: "CA" | "US";
  postal_code: string;
  mailing_same_as_billing: boolean;
  mailing_address_1: string;
  mailing_address_2: string;
  mailing_city: string;
  mailing_province: string;
  mailing_country: "CA" | "US";
  mailing_postal_code: string;
  phone_home: string;
  phone_cell: string;
  phone_business: string;
  phone_business_ext: string;
  phone_fax: string;
  phone_alt_1: string;
  phone_alt_2: string;
  contact_no: string;
  email: string;
  other_contact: string;
  comments: string;
  phone_notes: Record<string, string>;
  contact_method: "mail" | "email" | "phone" | "sms" | "";
  customer_type: "fleet" | "single" | "";
  default_pay_method: string;
  cod_required: boolean;
  labour_discount_pct: number;
  parts_discount_pct: number;
  late_payment_pct: number;
  late_payment_days: number;
  calc_interest_from: string;
  special_hst_rate_pct: string;
  pays_hst: boolean;
  notes: string;
};

const empty: FormValues = {
  code: "",
  last_or_company: "",
  card_number: "",
  card_expiry: "",
  card_cvv: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "ON",
  country: "CA",
  postal_code: "",
  mailing_same_as_billing: true,
  mailing_address_1: "",
  mailing_address_2: "",
  mailing_city: "",
  mailing_province: "ON",
  mailing_country: "CA",
  mailing_postal_code: "",
  phone_home: "",
  phone_cell: "",
  phone_business: "",
  phone_business_ext: "",
  phone_fax: "",
  phone_alt_1: "",
  phone_alt_2: "",
  contact_no: "",
  email: "",
  other_contact: "",
  comments: "",
  phone_notes: {},
  contact_method: "email",
  customer_type: "",
  default_pay_method: NO_PAY_METHOD,
  cod_required: false,
  labour_discount_pct: 0,
  parts_discount_pct: 0,
  late_payment_pct: 0,
  late_payment_days: 0,
  calc_interest_from: "",
  special_hst_rate_pct: "",
  pays_hst: true,
  notes: "",
};

function valuesFromCustomer(c: Customer): FormValues {
  // Treat mailing as "same as billing" when every mailing-* field exactly
  // matches the corresponding billing field. That's the most useful heuristic:
  // if they diverge for any reason, the user sees the divergence and decides.
  const sameAsBilling =
    (c.mailing_address_1 ?? "") === (c.address_1 ?? "") &&
    (c.mailing_address_2 ?? "") === (c.address_2 ?? "") &&
    (c.mailing_city ?? "") === (c.city ?? "") &&
    (c.mailing_province ?? "") === (c.province ?? "") &&
    (c.mailing_country ?? "") === (c.country ?? "") &&
    (c.mailing_postal_code ?? "") === (c.postal_code ?? "");

  return {
    code: c.code ?? "",
    last_or_company: c.last_or_company ?? c.billing_name ?? "",
    card_number: c.card_number ?? "",
    card_expiry: c.card_expiry ?? "",
    card_cvv: c.card_cvv ?? "",
    address_1: c.address_1 ?? "",
    address_2: c.address_2 ?? "",
    city: c.city ?? "",
    province: c.province ?? "ON",
    country: (c.country as "CA" | "US") || "CA",
    postal_code: c.postal_code ?? "",
    mailing_same_as_billing: sameAsBilling,
    mailing_address_1: c.mailing_address_1 ?? "",
    mailing_address_2: c.mailing_address_2 ?? "",
    mailing_city: c.mailing_city ?? "",
    mailing_province: c.mailing_province ?? "ON",
    mailing_country: (c.mailing_country as "CA" | "US") || "CA",
    mailing_postal_code: c.mailing_postal_code ?? "",
    phone_home: c.phone_home ?? "",
    phone_cell: c.phone_cell ?? "",
    phone_business: c.phone_business ?? "",
    phone_business_ext: c.phone_business_ext ?? "",
    phone_fax: c.phone_fax ?? "",
    phone_alt_1: c.phone_alt_1 ?? "",
    phone_alt_2: c.phone_alt_2 ?? "",
    contact_no: c.contact_no ?? "",
    email: c.email ?? "",
    other_contact: c.other_contact ?? "",
    comments: c.comments ?? "",
    phone_notes: c.phone_notes ?? {},
    contact_method: c.contact_method ?? "email",
    customer_type: c.customer_type ?? "",
    default_pay_method: c.default_pay_method ?? NO_PAY_METHOD,
    cod_required: c.cod_required ?? false,
    labour_discount_pct: Number(c.labour_discount_pct ?? 0),
    parts_discount_pct: Number(c.parts_discount_pct ?? 0),
    late_payment_pct: Number(c.late_payment_pct ?? 0),
    late_payment_days: Number(c.late_payment_days ?? 0),
    calc_interest_from: c.calc_interest_from ?? "",
    special_hst_rate_pct: c.special_hst_rate_pct?.toString() ?? "",
    pays_hst: c.pays_hst ?? true,
    notes: c.notes ?? "",
  };
}

export interface CustomerFormProps {
  /** Existing customer (edit) or undefined (create). */
  customer?: Customer;
  /** Initial vehicles list (edit-mode only). */
  initialVehicles?: Vehicle[];
  /** Called after a successful save with the saved record. */
  onSaved?: (customer: Customer) => void;
  /** Called when user cancels (e.g. close dialog). */
  onCancel?: () => void;
}

type StagedRow = StagedVehicleInput & { _clientId: string };

function makeClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `staged-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CustomerForm({
  customer,
  initialVehicles = [],
  onSaved,
  onCancel,
}: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Which submit button was clicked — drives post-save navigation.
  // Reset to "save" before every submit so a previous click doesn't leak.
  const [submitIntent, setSubmitIntent] = useState<"save" | "save-and-add-job">("save");
  const form = useForm<FormValues>({
    defaultValues: customer ? valuesFromCustomer(customer) : empty,
  });
  const country = form.watch("country");
  const mailingCountry = form.watch("mailing_country");
  const mailingSameAsBilling = form.watch("mailing_same_as_billing");
  const lastOrCompany = form.watch("last_or_company");
  const mode: "create" | "edit" = customer ? "edit" : "create";

  // Live "this name already exists" warning (debounced), like the part-number
  // check. Excludes the current customer in edit mode.
  const [nameMatches, setNameMatches] = useState<
    { id: string; billing_name: string | null; active: boolean }[]
  >([]);
  useEffect(() => {
    const trimmed = (lastOrCompany ?? "").trim();
    if (trimmed.length < 3) {
      setNameMatches([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await checkCustomerNameExists({
          name: trimmed,
          excludeId: customer?.id ?? null,
        });
        if (!cancelled) setNameMatches(res.matches);
      } catch {
        if (!cancelled) setNameMatches([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [lastOrCompany, customer?.id]);

  // Edit mode — vehicles are real DB rows.
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  // Create mode — vehicles are staged in client state and batch-created
  // after the customer save succeeds (vehicles need customer_id FK).
  const [stagedVehicles, setStagedVehicles] = useState<StagedRow[]>([]);
  const [vehicleDialog, setVehicleDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; vehicle: Vehicle }
    | { mode: "create-staged" }
    | { mode: "edit-staged"; row: StagedRow }
    | null
  >(null);

  useEffect(() => {
    if (customer) form.reset(valuesFromCustomer(customer));
  }, [customer, form]);

  useEffect(() => {
    setVehicles(initialVehicles);
  }, [initialVehicles]);

  const refreshVehicles = async () => {
    if (!customer) return;
    const vs = await getCustomerVehicles(customer.id);
    setVehicles(vs);
  };

  const onSubmit = form.handleSubmit((values) => {
    // "Same as billing" mirrors the billing fields into mailing_*. Persisting
    // the copy means downstream PDFs / mail-merge don't need fallback logic.
    const mailingSrc = values.mailing_same_as_billing
      ? {
          mailing_address_1: values.address_1,
          mailing_address_2: values.address_2,
          mailing_city: values.city,
          mailing_province: values.province,
          mailing_country: values.country,
          mailing_postal_code: values.postal_code,
        }
      : {
          mailing_address_1: values.mailing_address_1,
          mailing_address_2: values.mailing_address_2,
          mailing_city: values.mailing_city,
          mailing_province: values.mailing_province,
          mailing_country: values.mailing_country,
          mailing_postal_code: values.mailing_postal_code,
        };

    const payload = {
      code: values.code || null,
      salutation: null,
      last_or_company: values.last_or_company || null,
      card_number: values.card_number || null,
      card_expiry: values.card_expiry || null,
      card_cvv: values.card_cvv || null,
      billing_name: null,
      address_1: values.address_1 || null,
      address_2: values.address_2 || null,
      city: values.city || null,
      province: values.province || null,
      country: values.country,
      postal_code: values.postal_code || null,
      mailing_address_1: mailingSrc.mailing_address_1 || null,
      mailing_address_2: mailingSrc.mailing_address_2 || null,
      mailing_city: mailingSrc.mailing_city || null,
      mailing_province: mailingSrc.mailing_province || null,
      mailing_country: mailingSrc.mailing_country,
      mailing_postal_code: mailingSrc.mailing_postal_code || null,
      phone_home: values.phone_home || null,
      phone_cell: values.phone_cell || null,
      phone_business: values.phone_business || null,
      phone_business_ext: values.phone_business_ext || null,
      phone_fax: values.phone_fax || null,
      phone_alt_1: values.phone_alt_1 || null,
      phone_alt_2: values.phone_alt_2 || null,
      contact_no: values.contact_no || null,
      email: values.email || null,
      other_contact: values.other_contact || null,
      comments: values.comments || null,
      phone_notes: values.phone_notes ?? {},
      contact_method: values.contact_method || null,
      // "_" is the Select's placeholder sentinel — treat as null.
      customer_type:
        values.customer_type === "fleet" || values.customer_type === "single"
          ? values.customer_type
          : null,
      default_pay_method:
        values.default_pay_method && values.default_pay_method !== NO_PAY_METHOD
          ? values.default_pay_method
          : null,
      cod_required: values.cod_required,
      labour_discount_pct: Number(values.labour_discount_pct) || 0,
      parts_discount_pct: Number(values.parts_discount_pct) || 0,
      late_payment_pct: Number(values.late_payment_pct) || 0,
      late_payment_days: Number(values.late_payment_days) || 0,
      calc_interest_from: values.calc_interest_from || null,
      special_hst_rate_pct: values.special_hst_rate_pct
        ? Number(values.special_hst_rate_pct)
        : null,
      pays_hst: values.pays_hst,
      notes: values.notes || null,
      license_plates: customer?.license_plates ?? [],
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

      // Batch-create staged vehicles now that we have customer.id.
      // Note: any failures are surfaced but the customer is already saved.
      const createdVehicleIds: string[] = [];
      if (mode === "create" && stagedVehicles.length > 0) {
        const customerId = res.data.id;
        let okCount = 0;
        const failed: string[] = [];
        for (const sv of stagedVehicles) {
          const { _clientId, ...spec } = sv;
          void _clientId;
          const payload = { ...spec, customer_id: customerId };
          const v = await createVehicle(payload);
          if (v.ok) {
            okCount++;
            createdVehicleIds.push(v.data.id);
          } else {
            console.error("[staged-vehicle-save] failed", { payload, error: v });
            failed.push(`${sv.license_plate}: ${v.error}`);
          }
        }
        if (failed.length > 0) {
          toast.error(
            `Customer saved, but ${failed.length} of ${stagedVehicles.length} vehicle(s) failed.`,
            { description: failed.join("\n"), duration: 10000 },
          );
        } else if (okCount > 0) {
          toast.success(
            `Customer + ${okCount} vehicle${okCount === 1 ? "" : "s"} created`,
          );
        } else {
          toast.success("Customer created");
        }
        // Clear staging on success so the form doesn't re-submit if the
        // dialog is reopened on the same parent component.
        setStagedVehicles([]);
      } else {
        toast.success(mode === "create" ? "Customer created" : "Customer updated");
      }

      // "Save and add new job" — jump straight into the new-sales-job form
      // with the customer pre-selected. The form runs in create mode only;
      // editing existing customers always uses plain "save".
      if (mode === "create" && submitIntent === "save-and-add-job") {
        // If exactly one vehicle was created, pre-select it on the new job.
        const vqs =
          createdVehicleIds.length === 1 ? `&vehicle_id=${createdVehicleIds[0]}` : "";
        router.push(`/sales/new?customer_id=${res.data.id}${vqs}`);
        return;
      }

      onSaved?.(res.data);
    });
  });

  const onDeactivateVehicle = (v: Vehicle) => {
    if (!confirm(`Deactivate vehicle ${v.license_plate}?`)) return;
    startTransition(async () => {
      const res = await deactivateVehicle({ id: v.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Vehicle deactivated");
      refreshVehicles();
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className="space-y-6"
        onKeyDown={(e) => {
          // Save only via the Save button — Enter in a field must not submit.
          if (
            e.key === "Enter" &&
            e.target instanceof HTMLElement &&
            e.target.tagName === "INPUT" &&
            !e.target.closest("[cmdk-root]")
          ) {
            e.preventDefault();
          }
        }}
      >
        <div className="space-y-8">

          {/* ------------------------------------------------------ Identity */}
          <section className="space-y-4">
            <SectionHeader title="Identity" />
            <FormField
              control={form.control}
              name="last_or_company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name / Company name *</FormLabel>
                  <FormControl>
                    <UppercaseInput placeholder="Last name or company name" {...field} />
                  </FormControl>
                  {nameMatches.length > 0 && (
                    <div className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <div>
                        <div className="font-medium">
                          Similar customer{nameMatches.length > 1 ? "s" : ""} already exist
                          {nameMatches.length > 1 ? "" : "s"}
                        </div>
                        <ul className="mt-0.5 space-y-0.5">
                          {nameMatches.slice(0, 3).map((m) => (
                            <li key={m.id}>
                              <Link
                                href={`/customers/${m.id}`}
                                target="_blank"
                                className="font-medium underline underline-offset-2 hover:no-underline"
                              >
                                {m.billing_name ?? "—"}
                              </Link>
                              {!m.active && (
                                <span className="ml-1 text-muted-foreground">(inactive)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="customer_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "_"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_">—</SelectItem>
                        <SelectItem value="fleet">Fleet</SelectItem>
                        <SelectItem value="single">Single</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer code</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional short code" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ------------------------------------------------------ Billing address */}
          <section className="space-y-4">
            <SectionHeader title="Billing address" />
            <FormField
              control={form.control}
              name="address_1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address 1</FormLabel>
                  <FormControl><UppercaseInput placeholder="Street address" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address_2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address 2</FormLabel>
                  <FormControl><UppercaseInput placeholder="Suite, unit, etc. (optional)" {...field} /></FormControl>
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City / Town</FormLabel>
                    <FormControl><UppercaseInput placeholder="City" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal / ZIP</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder={postalPlaceholder(country)} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <CountrySelect value={field.value} onChange={field.onChange} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{country === "US" ? "State" : "Province"}</FormLabel>
                    <ProvinceSelect
                      country={country}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ------------------------------------------------------ Mailing address */}
          <section className="space-y-4">
            <SectionHeader title="Mailing address" />
            <FormField
              control={form.control}
              name="mailing_same_as_billing"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      id="mailing_same_as_billing"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <label htmlFor="mailing_same_as_billing" className="text-sm cursor-pointer">
                    Same as billing address
                  </label>
                </FormItem>
              )}
            />
            {!mailingSameAsBilling && (
              <>
                <FormField
                  control={form.control}
                  name="mailing_address_1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address 1</FormLabel>
                      <FormControl><UppercaseInput placeholder="Street address" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mailing_address_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address 2</FormLabel>
                      <FormControl><UppercaseInput placeholder="Suite, unit, etc. (optional)" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="mailing_city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City / Town</FormLabel>
                        <FormControl><UppercaseInput placeholder="City" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailing_postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal / ZIP</FormLabel>
                        <FormControl>
                          <UppercaseInput placeholder={postalPlaceholder(mailingCountry)} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailing_country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <CountrySelect value={field.value} onChange={field.onChange} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailing_province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{mailingCountry === "US" ? "State" : "Province"}</FormLabel>
                        <ProvinceSelect
                          country={mailingCountry}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </section>

          {/* ------------------------------------------------------ Phones */}
          <section className="space-y-4">
            <SectionHeader
              title="Phones"
              hint="Each phone has a notes button (icon next to the field) for call-time preferences, who to ask for, etc."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <PhoneSlot form={form} name="phone_cell" label="Cell" notesKey="cell" />
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <PhoneSlot
                  form={form}
                  name="phone_business"
                  label="Business"
                  notesKey="business"
                />
                <FormField
                  control={form.control}
                  name="phone_business_ext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ext</FormLabel>
                      <FormControl><Input maxLength={10} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <PhoneSlot form={form} name="phone_home" label="Home" notesKey="home" />
              <PhoneSlot form={form} name="phone_fax" label="Fax" notesKey="fax" />
              <PhoneSlot form={form} name="phone_alt_1" label="Alternate 1" notesKey="alt_1" />
              <PhoneSlot form={form} name="phone_alt_2" label="Alternate 2" notesKey="alt_2" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "email"}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["mail", "email", "phone", "sms"] as const).map((m) => (
                          <SelectItem key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="other_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other contact</FormLabel>
                    <FormControl><UppercaseInput {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ------------------------------------------------------ Billing */}
          <section className="space-y-4">
            <SectionHeader title="Billing" />

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="card_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Card number</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="Card number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="card_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry</FormLabel>
                    <FormControl>
                      <Input placeholder="MM/YY" maxLength={7} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="card_cvv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVV</FormLabel>
                    <FormControl>
                      <Input placeholder="CVV" maxLength={4} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="default_pay_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default pay method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NO_PAY_METHOD}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PAY_METHOD}>—</SelectItem>
                        {(["cash", "cheque", "debit", "visa", "mastercard", "etransfer", "oc", "credit_card"] as const).map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cod_required"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>C.O.D. required</FormLabel>
                    <div className="flex h-9 items-center">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="cod_required"
                        />
                      </FormControl>
                      <label htmlFor="cod_required" className="ml-2 text-sm">
                        Require C.O.D.
                      </label>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pays_hst"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>HST</FormLabel>
                    <div className="flex h-9 items-center">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="pays_hst"
                        />
                      </FormControl>
                      <label htmlFor="pays_hst" className="ml-2 text-sm">
                        Pays HST
                      </label>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="labour_discount_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labour discount %</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parts_discount_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parts discount %</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="special_hst_rate_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special HST rate %</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="late_payment_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late payment %</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="late_payment_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Every N days</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="calc_interest_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calc interest from</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments / notes</FormLabel>
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                </FormItem>
              )}
            />
          </section>

          {/* ------------------------------------------------------ Vehicles */}
          <section className="space-y-4 rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Vehicles</h3>
                <p className="text-xs text-muted-foreground">
                  {customer
                    ? "License plate and VIN are unique across the company."
                    : "Add as many trucks as you want — they'll be saved together with the customer."}
                </p>
              </div>
              <Button
                type="button"
                className="font-semibold"
                onClick={() =>
                  setVehicleDialog(
                    customer ? { mode: "create" } : { mode: "create-staged" },
                  )
                }
              >
                <Plus className="size-4" /> Add vehicle
              </Button>
            </div>

            {/* Edit mode — live DB rows */}
            {customer && vehicles.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>License</TableHead>
                      <TableHead>VIN</TableHead>
                      <TableHead>Year / Make / Model</TableHead>
                      <TableHead>Unit #</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Mileage</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono">{v.license_plate}</TableCell>
                        <TableCell className="font-mono text-xs">{v.vin ?? "—"}</TableCell>
                        <TableCell>
                          {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell>{v.unit_number ?? "—"}</TableCell>
                        <TableCell>{v.carrier_name ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">
                          {v.mileage != null ? v.mileage.toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setVehicleDialog({ mode: "edit", vehicle: v })
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeactivateVehicle(v)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Create mode — staged rows (not yet in DB) */}
            {!customer && stagedVehicles.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>License</TableHead>
                      <TableHead>VIN</TableHead>
                      <TableHead>Year / Make / Model</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stagedVehicles.map((sv) => (
                      <TableRow key={sv._clientId}>
                        <TableCell className="font-mono">{sv.license_plate}</TableCell>
                        <TableCell className="font-mono text-xs">{sv.vin ?? "—"}</TableCell>
                        <TableCell>
                          {[sv.year, sv.make, sv.model].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell>{sv.carrier_name ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setVehicleDialog({ mode: "edit-staged", row: sv })
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setStagedVehicles((prev) =>
                                  prev.filter((x) => x._clientId !== sv._clientId),
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  These vehicles will be saved when you click <strong>Save</strong>.
                </p>
              </div>
            )}

            {/* Empty state */}
            {((customer && vehicles.length === 0) ||
              (!customer && stagedVehicles.length === 0)) && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No vehicles yet. Click <strong>Add vehicle</strong> to register a truck.
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
          )}
          {mode === "create" && (
            <Button
              type="submit"
              variant="outline"
              disabled={isPending}
              onClick={() => setSubmitIntent("save-and-add-job")}
            >
              {isPending && submitIntent === "save-and-add-job"
                ? "Saving…"
                : "Save & add new job"}
            </Button>
          )}
          <Button
            type="submit"
            disabled={isPending}
            onClick={() => setSubmitIntent("save")}
          >
            {isPending && submitIntent === "save" ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      {/* Live (DB) vehicle dialog — edit mode */}
      {customer && vehicleDialog && (vehicleDialog.mode === "create" || vehicleDialog.mode === "edit") && (
        <VehicleFormDialog
          open={vehicleDialog !== null}
          onOpenChange={(open) => {
            if (!open) setVehicleDialog(null);
          }}
          customerId={customer.id}
          vehicle={vehicleDialog.mode === "edit" ? vehicleDialog.vehicle : undefined}
          onSaved={() => {
            setVehicleDialog(null);
            refreshVehicles();
          }}
        />
      )}

      {/* Staged vehicle dialog — create mode (no customer yet) */}
      {!customer && vehicleDialog &&
        (vehicleDialog.mode === "create-staged" || vehicleDialog.mode === "edit-staged") && (
          <VehicleFormDialog
            open={vehicleDialog !== null}
            onOpenChange={(open) => {
              if (!open) setVehicleDialog(null);
            }}
            initialStaged={
              vehicleDialog.mode === "edit-staged" ? vehicleDialog.row : undefined
            }
            onStaged={(values) => {
              if (vehicleDialog.mode === "edit-staged") {
                const editingId = vehicleDialog.row._clientId;
                setStagedVehicles((prev) =>
                  prev.map((row) =>
                    row._clientId === editingId
                      ? { ...values, _clientId: editingId }
                      : row,
                  ),
                );
              } else {
                setStagedVehicles((prev) => [
                  ...prev,
                  { ...values, _clientId: makeClientId() },
                ]);
              }
              setVehicleDialog(null);
            }}
          />
        )}
    </Form>
  );
}

// PhoneSlot — combines a phone-with-notes field bound to RHF state.
// Notes live in form.phone_notes[notesKey] so they round-trip with the
// customers.phone_notes jsonb column.
function PhoneSlot({
  form,
  name,
  label,
  notesKey,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  name:
    | "phone_home"
    | "phone_cell"
    | "phone_business"
    | "phone_fax"
    | "phone_alt_1"
    | "phone_alt_2";
  label: string;
  notesKey: string;
}) {
  const value = form.watch(name) ?? "";
  const notes = form.watch("phone_notes") ?? {};
  const note = notes[notesKey] ?? "";

  return (
    <FormField
      control={form.control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <PhoneWithNotes
              value={value}
              onChange={(digits) => form.setValue(name, digits, { shouldDirty: true })}
              note={note}
              onNoteChange={(v) =>
                form.setValue(
                  "phone_notes",
                  { ...notes, [notesKey]: v },
                  { shouldDirty: true },
                )
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-b pb-1.5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
