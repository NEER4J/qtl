import { z } from "zod";

const code = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(max, `Code must be ${max} characters or fewer`)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, digits, or underscores");

// ============================================================================
// oil_types
// ============================================================================
export const CreateOilTypeInput = z.object({
  code: code(30),
  name: z.string().trim().min(1, "Name is required").max(120),
  is_base: z.coerce.boolean().default(false),
  bulk_cost_per_litre: z.coerce.number().min(0, "Must be ≥ 0"),
  gallon_cost_per_litre: z.coerce.number().min(0, "Must be ≥ 0"),
  sort_order: z.coerce.number().int().min(0).default(100),
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
  category: z.string().trim().min(1, "Category is required").max(60),
  description: trimmedOrNull,
  cost: z.coerce.number().min(0, "Must be ≥ 0"),
  list_price: z.coerce.number().min(0, "Must be ≥ 0"),
  mhsw_fee: z.coerce.number().min(0, "Must be ≥ 0").default(0),
  service_cost_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v == null || v === "" ? null : v)),
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
  sort_order: z.coerce.number().int().min(0).default(100),
  active: z.coerce.boolean().default(true),
});
export type CreatePartCategoryInput = z.infer<typeof CreatePartCategoryInput>;

export const UpdatePartCategoryInput = CreatePartCategoryInput.extend({
  id: z.string().uuid(),
});
export type UpdatePartCategoryInput = z.infer<typeof UpdatePartCategoryInput>;

export const CreatePartBrandInput = CreatePartCategoryInput;
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
