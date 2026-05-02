import { z } from "zod";

import { paymentModeSchema } from "@/lib/schemas/common";
import { normalizePhone } from "@/lib/utils/phone";

const textOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v));

const upperOptional = (max: number) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .max(max)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v));

const dateNullable = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"), z.string().length(0), z.null()])
  .nullable()
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

const emailNullable = z
  .string()
  .trim()
  .email("Invalid email")
  .max(120)
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((v) => (v === "" || v == null ? null : v));

// Phone fields: stored as digits-only (10 digits) so the DB stays consistent
// regardless of how the UI formats them. Empty -> null. Anything else must
// be exactly 10 NA digits (drops a leading "1" country code if present).
const phoneOptional = z
  .string()
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    if (!v) return null;
    const digits = normalizePhone(v);
    const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    return ten;
  })
  .refine((v) => v === null || v === "" || /^\d{10}$/.test(v), {
    message: "Enter a 10-digit phone number",
  })
  .transform((v) => (v === "" ? null : v));

export const CreateCustomerInput = z.object({
  code: textOptional(40),

  // Name (CARS layout: salutation + first + last/company)
  salutation: textOptional(20),
  first_name: upperOptional(120),
  last_or_company: upperOptional(200),
  // Legacy single field; kept for backward compat. New form derives it from first + last.
  billing_name: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v)),

  // Address (item #2)
  address_1: textOptional(200),
  address_2: textOptional(200),
  city: textOptional(80),
  province: textOptional(60),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default("CA"),
  postal_code: textOptional(20),

  // Phones (item #13 — display formatted client-side)
  contact_no: phoneOptional,
  phone_home: phoneOptional,
  phone_cell: phoneOptional,
  phone_business: phoneOptional,
  phone_business_ext: textOptional(10),
  phone_fax: phoneOptional,
  phone_alt_1: phoneOptional,
  phone_alt_2: phoneOptional,
  phone_notes: z.record(z.string(), z.string().max(500)).optional().default({}),

  // Contact / classification
  email: emailNullable,
  other_contact: textOptional(200),
  comments: textOptional(2000),
  contact_method: z
    .enum(["mail", "email", "phone", "sms"])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  customer_type: textOptional(60),
  status: z.enum(["new", "regular", "old"]).default("new"),

  // Billing options (item #3)
  default_pay_method: paymentModeSchema.nullable().optional(),
  cod_required: z.coerce.boolean().default(false),
  labour_discount_pct: z.coerce.number().min(0).max(100).default(0),
  parts_discount_pct: z.coerce.number().min(0).max(100).default(0),
  late_payment_pct: z.coerce.number().min(0).max(100).default(0),
  late_payment_days: z.coerce.number().int().min(0).max(365).default(0),
  calc_interest_from: dateNullable,
  special_hst_rate_pct: z.coerce.number().min(0).max(100).nullable().optional(),
  pays_hst: z.coerce.boolean().default(true),

  // Free grease (item #15) — server sets default on insert via trigger;
  // form may carry it for display but the server ignores incoming value
  // unless the role is owner.
  free_grease_until: dateNullable,

  home_location_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  notes: textOptional(2000),

  // Legacy plates array — still accepted on input; server splits new plates
  // into the vehicles table during a transition release.
  license_plates: z.array(z.string().trim().toUpperCase().max(15)).default([]),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;

export const UpdateCustomerInput = CreateCustomerInput.extend({
  id: z.string().uuid(),
});

export const SearchCustomersInput = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["new", "regular", "old"]).nullable().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const SetCustomerStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "regular", "old"]),
});
