"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { createCustomer, updateCustomer } from "@/lib/actions/customers";
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
  salutation: string;
  last_or_company: string;
  card_number: string;
  address_1: string;
  address_2: string;
  city: string;
  province: string;
  country: "CA" | "US";
  postal_code: string;
  phone_home: string;
  phone_cell: string;
  phone_business: string;
  phone_business_ext: string;
  phone_fax: string;
  phone_alt_1: string;
  phone_alt_2: string;
  contact_no: string;
  other_contact: string;
  comments: string;
  phone_notes: Record<string, string>;
  contact_method: "mail" | "email" | "phone" | "sms" | "";
  customer_type: string;
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
  salutation: "",
  last_or_company: "",
  card_number: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "",
  country: "CA",
  postal_code: "",
  phone_home: "",
  phone_cell: "",
  phone_business: "",
  phone_business_ext: "",
  phone_fax: "",
  phone_alt_1: "",
  phone_alt_2: "",
  contact_no: "",
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
  return {
    code: c.code ?? "",
    salutation: c.salutation ?? "",
    last_or_company: c.last_or_company ?? c.billing_name ?? "",
    card_number: c.card_number ?? "",
    address_1: c.address_1 ?? "",
    address_2: c.address_2 ?? "",
    city: c.city ?? "",
    province: c.province ?? "",
    country: (c.country as "CA" | "US") || "CA",
    postal_code: c.postal_code ?? "",
    phone_home: c.phone_home ?? "",
    phone_cell: c.phone_cell ?? "",
    phone_business: c.phone_business ?? "",
    phone_business_ext: c.phone_business_ext ?? "",
    phone_fax: c.phone_fax ?? "",
    phone_alt_1: c.phone_alt_1 ?? "",
    phone_alt_2: c.phone_alt_2 ?? "",
    contact_no: c.contact_no ?? "",
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
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    defaultValues: customer ? valuesFromCustomer(customer) : empty,
  });
  const country = form.watch("country");
  const mode: "create" | "edit" = customer ? "edit" : "create";

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
    const payload = {
      code: values.code || null,
      salutation: values.salutation || null,
      last_or_company: values.last_or_company || null,
      card_number: values.card_number || null,
      billing_name: null,
      address_1: values.address_1 || null,
      address_2: values.address_2 || null,
      city: values.city || null,
      province: values.province || null,
      country: values.country,
      postal_code: values.postal_code || null,
      phone_home: values.phone_home || null,
      phone_cell: values.phone_cell || null,
      phone_business: values.phone_business || null,
      phone_business_ext: values.phone_business_ext || null,
      phone_fax: values.phone_fax || null,
      phone_alt_1: values.phone_alt_1 || null,
      phone_alt_2: values.phone_alt_2 || null,
      contact_no: values.contact_no || null,
      other_contact: values.other_contact || null,
      comments: values.comments || null,
      phone_notes: values.phone_notes ?? {},
      contact_method: values.contact_method || null,
      customer_type: values.customer_type || null,
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
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-8">

          {/* ------------------------------------------------------ Identity */}
          <section className="space-y-4">
            <SectionHeader title="Identity" />
            <div className="grid gap-4 md:grid-cols-12">
              <FormField
                control={form.control}
                name="salutation"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Salutation</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "_"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_">None</SelectItem>
                        {["Mr.", "Mrs.", "Ms.", "Dr."].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_or_company"
                render={({ field }) => (
                  <FormItem className="md:col-span-10">
                    <FormLabel>Last / Company name *</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="ACME TRUCKING LTD." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="customer_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Input placeholder="(free text)" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="card_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Card number</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="(carrier or fleet card #)" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ------------------------------------------------------ Address */}
          <section className="space-y-4">
            <SectionHeader title="Address" />
            <FormField
              control={form.control}
              name="address_1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address 1</FormLabel>
                  <FormControl><UppercaseInput {...field} /></FormControl>
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
                  <FormControl><UppercaseInput {...field} /></FormControl>
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
                    <FormControl><UppercaseInput {...field} /></FormControl>
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

          {/* ------------------------------------------------------ Phones */}
          <section className="space-y-4">
            <SectionHeader
              title="Phones"
              hint="Each phone has a notes button (icon next to the field) for call-time preferences, who to ask for, etc."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <PhoneSlot form={form} name="phone_home" label="Home" notesKey="home" />
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
              <PhoneSlot form={form} name="phone_fax" label="Fax" notesKey="fax" />
              <PhoneSlot form={form} name="phone_alt_1" label="Alternate 1" notesKey="alt_1" />
              <PhoneSlot form={form} name="phone_alt_2" label="Alternate 2" notesKey="alt_2" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
          <section className="space-y-4">
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
                variant="outline"
                size="sm"
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
                  These vehicles will be saved when you click <strong>Create customer</strong>.
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
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : mode === "create" ? "Create customer" : "Save changes"}
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
