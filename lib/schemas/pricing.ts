import { z } from "zod";

const code = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(max, `Code must be ${max} characters or fewer`)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, digits, or underscores");

// ============================================================================
// unit_of_measure — pg enum, kept in sync with migration 0030.
// ============================================================================
export const UNIT_OF_MEASURE_VALUES = [
  "ltr",
  "gallon",
  "kg",
  "pcs",
  "hours",
  "each",
] as const;
export type UnitOfMeasureValue = (typeof UNIT_OF_MEASURE_VALUES)[number];
export const unitOfMeasureSchema = z.enum(UNIT_OF_MEASURE_VALUES);
export const UNIT_OF_MEASURE_OPTIONS: { value: UnitOfMeasureValue; label: string }[] = [
  { value: "ltr", label: "Litres (ltr)" },
  { value: "gallon", label: "Gallons" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "hours", label: "Hours" },
  { value: "each", label: "Each" },
];

// ============================================================================
// oil_types
// ============================================================================
export const CreateOilTypeInput = z.object({
  code: code(30),
  name: z.string().trim().min(1, "Name is required").max(120),
  is_base: z.coerce.boolean().default(false),
  bulk_cost_per_litre: z.coerce.number().min(0, "Must be ≥ 0"),
  gallon_cost_per_litre: z.coerce.number().min(0, "Must be ≥ 0"),
  litres_per_gallon: z.coerce
    .number()
    .positive("Litres per gallon must be greater than 0")
    .max(20, "That doesn't look like a gallon")
    .default(4.546),
  is_taxable: z.coerce.boolean().default(true),
  is_engine_oil: z.coerce.boolean().default(true),
  active: z.coerce.boolean().default(true),
});
export type CreateOilTypeInput = z.infer<typeof CreateOilTypeInput>;

export const UpdateOilTypeInput = CreateOilTypeInput.extend({
  id: z.string().uuid(),
});
export type UpdateOilTypeInput = z.infer<typeof UpdateOilTypeInput>;

// ============================================================================
// engine_types
// ============================================================================
export const CreateEngineTypeInput = z.object({
  manufacturer: z.string().trim().min(1, "Manufacturer is required").max(80),
  model: z.string().trim().min(1, "Model is required").max(80),
  oil_capacity_litres: z.coerce
    .number()
    .positive("Oil capacity must be greater than 0"),
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.coerce.boolean().default(true),
});
export type CreateEngineTypeInput = z.infer<typeof CreateEngineTypeInput>;

export const UpdateEngineTypeInput = CreateEngineTypeInput.extend({
  id: z.string().uuid(),
});
export type UpdateEngineTypeInput = z.infer<typeof UpdateEngineTypeInput>;

// ============================================================================
// parts
// ============================================================================
const trimmedOrNull = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v == null || v === "" ? null : v));

export const CreatePartInput = z.object({
  part_number: z.string().trim().min(1, "Part number is required").max(80),
  brand: z.string().trim().min(1, "Brand is required").max(60),
  category_id: z.string().uuid("Pick a category"),
  description: trimmedOrNull,
  cost: z.coerce.number().min(0, "Must be ≥ 0"),
  // Sell-side MHSW (added into list_price).
  mhsw_fee: z.coerce.number().min(0, "Must be ≥ 0").default(0),
  // Buy/cost-side MHSW — reference-only, no formula change.
  mhsw_buy: z.coerce.number().min(0, "Must be ≥ 0").default(0),
  // Per-part overrides. Empty = NULL = fall back to the global app_settings value.
  // Service charge — may be negative (discounts the With Service price).
  counter_premium: z
    .union([z.coerce.number().min(-9999999).max(9999999), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : Number(v))),
  customer_supplies_labour: z
    .union([z.coerce.number().min(0, "Must be ≥ 0").max(9999999), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : Number(v))),
  // Optional LIST of customer-supplies labour prices (blank entries dropped).
  customer_supplies_labour_options: z
    .array(z.coerce.number().min(0, "Must be ≥ 0").max(9999999))
    .optional()
    .default([]),
  margin_type: z.enum(["fixed", "percent"]).default("fixed"),
  margin_value: z.coerce.number().min(0, "Must be ≥ 0").default(0),
  // Signed delta applied to an existing same-category line when this part is added via a package.
  // Positive = upcharge (e.g. premium variant), negative = credit. Empty = 0.
  extra_price: z
    .union([z.coerce.number().min(-9999999).max(9999999), z.literal("")])
    .optional()
    .transform((v) => (v == null || v === "" ? 0 : Number(v))),
  service_cost_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v == null || v === "" ? null : v)),
  is_taxable: z.coerce.boolean().default(true),
  // Marks the part as bundled in a package — Without Service price is forced
  // to 0 and a second occurrence on the same sales job defaults to over_counter_price.
  in_package: z.coerce.boolean().default(false),
  // When true, the part's price is rounded up to the next .99 as it's added to a sales job.
  round_off: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
});
export type CreatePartInput = z.infer<typeof CreatePartInput>;

export const UpdatePartInput = CreatePartInput.extend({
  id: z.string().uuid(),
});
export type UpdatePartInput = z.infer<typeof UpdatePartInput>;

// ============================================================================
// service_costs
// ============================================================================
export const CreateServiceCostInput = z.object({
  code: code(40),
  name: z.string().trim().min(1, "Name is required").max(120),
  cost: z.coerce.number().min(0, "Must be ≥ 0"),
  active: z.coerce.boolean().default(true),
});
export type CreateServiceCostInput = z.infer<typeof CreateServiceCostInput>;

export const UpdateServiceCostInput = CreateServiceCostInput.extend({
  id: z.string().uuid(),
});
export type UpdateServiceCostInput = z.infer<typeof UpdateServiceCostInput>;

// ============================================================================
// volume_tiers
// ============================================================================
export const CreateVolumeTierInput = z.object({
  oil_type_id: z.string().uuid("Pick an oil type"),
  min_litres: z.coerce.number().min(0, "Must be ≥ 0"),
  premium: z.coerce.number().min(0, "Must be ≥ 0"),
});
export type CreateVolumeTierInput = z.infer<typeof CreateVolumeTierInput>;

export const UpdateVolumeTierInput = CreateVolumeTierInput.extend({
  id: z.string().uuid(),
});
export type UpdateVolumeTierInput = z.infer<typeof UpdateVolumeTierInput>;

export const DeleteVolumeTierInput = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// engine_filters
// ============================================================================
export const UpsertEngineFilterInput = z.object({
  engine_type_id: z.string().uuid(),
  part_id: z.string().uuid("Pick a part"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});
export type UpsertEngineFilterInput = z.infer<typeof UpsertEngineFilterInput>;

export const DeleteEngineFilterInput = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// part_categories / part_brands (reference lookup tables)
// ============================================================================
export const CreatePartCategoryInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  unit_of_measure: unitOfMeasureSchema.default("pcs"),
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.coerce.boolean().default(true),
});
export type CreatePartCategoryInput = z.infer<typeof CreatePartCategoryInput>;

export const UpdatePartCategoryInput = CreatePartCategoryInput.extend({
  id: z.string().uuid(),
});
export type UpdatePartCategoryInput = z.infer<typeof UpdatePartCategoryInput>;

export const CreatePartBrandInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.coerce.boolean().default(true),
});
export type CreatePartBrandInput = z.infer<typeof CreatePartBrandInput>;

export const UpdatePartBrandInput = CreatePartBrandInput.extend({
  id: z.string().uuid(),
});
export type UpdatePartBrandInput = z.infer<typeof UpdatePartBrandInput>;

// ============================================================================
// Shared toggle-active schema
// ============================================================================
export const ToggleActiveInput = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

// ============================================================================
// transmission_services — Trans & Diff catalogue (create / update / toggle)
// ============================================================================
export const TransmissionServiceKindEnum = z.enum([
  "allison_trans",
  "trans",
  "diff",
  "combined",
  "specialty_trans",
  "coolant_flush",
]);

export const CreateTransmissionServiceInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  service_kind: TransmissionServiceKindEnum,
  is_synthetic: z.coerce.boolean().default(false),
  oil_type_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v == null || v === "" ? null : v)),
  // Capacity in litres — optional, must be > 0 when present (DB: litres > 0).
  litres: z
    .union([z.coerce.number().positive("Must be > 0").max(9999), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : Number(v))),
  // Hand-set sell price (DB: sell_price > 0).
  sell_price: z.coerce.number().positive("Sell price must be greater than 0"),
  // Fixed labour (e.g. coolant flush) — optional, ≥ 0.
  labour: z
    .union([z.coerce.number().min(0, "Must be ≥ 0").max(9999999), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : Number(v))),
  notes: trimmedOrNull,
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.coerce.boolean().default(true),
});
export type CreateTransmissionServiceInput = z.infer<typeof CreateTransmissionServiceInput>;

export const UpdateTransmissionServiceInput = CreateTransmissionServiceInput.extend({
  id: z.string().uuid(),
});
export type UpdateTransmissionServiceInput = z.infer<typeof UpdateTransmissionServiceInput>;

// ============================================================================
// part_packages — pre-defined bundles of parts with default qty
// ============================================================================
export const PartPackageItemInput = z
  .object({
    // Exactly one source: a catalogue part OR a Trans & Diff service.
    // (Oil-typed package items are seeded/managed outside this form and are
    // preserved on edit rather than sent through here.)
    part_id: z.string().uuid().nullable().optional(),
    transmission_service_id: z.string().uuid().nullable().optional(),
    quantity: z.coerce.number().positive("Qty must be > 0").max(99999),
    // Optional override; null/undefined → use the catalogue price at expansion.
    unit_price: z
      .union([z.coerce.number().min(0).max(9999999), z.null()])
      .optional()
      .nullable(),
  })
  .superRefine((it, ctx) => {
    const sources = [it.part_id, it.transmission_service_id].filter(Boolean).length;
    if (sources !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["part_id"],
        message: "Each item must be either a part or a Trans & Diff service.",
      });
    }
  });
export type PartPackageItemInput = z.infer<typeof PartPackageItemInput>;

export const CreatePartPackageInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  active: z.coerce.boolean().default(true),
  labor_selling_price: z.coerce.number().min(0, "Must be ≥ 0").default(0),
  labor_description: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v)),
  items: z
    .array(PartPackageItemInput)
    .min(1, "Add at least one item")
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      items.forEach((it, i) => {
        const key = it.part_id
          ? `part:${it.part_id}`
          : it.transmission_service_id
          ? `trans:${it.transmission_service_id}`
          : `?:${i}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, "part_id"],
            message: "Each item can only appear once in a package.",
          });
        }
        seen.add(key);
      });
    }),
});
export type CreatePartPackageInput = z.infer<typeof CreatePartPackageInput>;

export const UpdatePartPackageInput = CreatePartPackageInput.extend({
  id: z.string().uuid(),
});
export type UpdatePartPackageInput = z.infer<typeof UpdatePartPackageInput>;

// ============================================================================
// part_packages — price lock / merge
// ============================================================================
export const LockPartPackageInput = z.object({
  id: z.string().uuid(),
  // ISO date (YYYY-MM-DD). Must be today or in the future.
  lock_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .refine(
      (s) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(`${s}T00:00:00`);
        return !Number.isNaN(d.getTime()) && d.getTime() >= today.getTime();
      },
      { message: "Lock date must be today or later" },
    ),
});
export type LockPartPackageInput = z.infer<typeof LockPartPackageInput>;

export const UnlockPartPackageInput = z.object({ id: z.string().uuid() });
export type UnlockPartPackageInput = z.infer<typeof UnlockPartPackageInput>;

export const MergePartPackagePricesInput = z.object({
  id: z.string().uuid(),
  labor_selling_price: z.coerce.number().min(0, "Must be ≥ 0"),
  items: z.array(
    z.object({
      item_id: z.string().uuid(),
      new_unit_price: z.coerce.number().min(0, "Must be ≥ 0"),
    }),
  ),
});
export type MergePartPackagePricesInput = z.infer<typeof MergePartPackagePricesInput>;
