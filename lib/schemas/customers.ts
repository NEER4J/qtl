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

  // Name
  salutation: textOptional(20),
  last_or_company: upperOptional(200),
  billing_name: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v)),

  // Billing address (item #2) — uppercase-locked at the form & schema level
  address_1: upperOptional(200),
  address_2: upperOptional(200),
  city: upperOptional(80),
  province: upperOptional(60),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default("CA"),
  postal_code: upperOptional(20),

  // Mailing address — UI offers a "same as billing" checkbox that copies the
  // billing fields into these. We still persist them separately so PDFs and
  // mail-merge templates don't need fallback logic.
  mailing_address_1: upperOptional(200),
  mailing_address_2: upperOptional(200),
  mailing_city: upperOptional(80),
  mailing_province: upperOptional(60),
  mailing_country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default("CA"),
  mailing_postal_code: upperOptional(20),

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
  customer_type: z
    .enum(["fleet", "single"])
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v)),

  // Item #23 — carrier/customer-level card details. WARNING: CVV violates
  // PCI-DSS; kept by explicit client request (2026-05-22).
  card_number: upperOptional(60),
  card_expiry: textOptional(10),
  card_cvv: textOptional(8),

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
  // Item #29 — 30-day free oil-change offer; same shape as free_grease_until.
  free_oil_change_until: dateNullable,

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
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const MergeCustomersInput = z
  .object({
    target_id: z.string().uuid(),
    source_ids: z.array(z.string().uuid()).min(1, "Pick at least one duplicate to merge in"),
  })
  .refine((v) => !v.source_ids.includes(v.target_id), {
    message: "The primary customer can't also be a duplicate",
  });
export type MergeCustomersInput = z.infer<typeof MergeCustomersInput>;

/** Server-side paging + search for the /customers list. */
export const ListCustomersInput = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
