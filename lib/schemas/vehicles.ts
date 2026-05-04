import { z } from "zod";

const upperString = (max: number) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .max(max);

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

const textOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? null : v));

export const CreateVehicleInput = z.object({
  customer_id: z.string().uuid(),
  license_plate: upperString(15).min(1, "License plate is required"),
  vin: upperOptional(40),
  year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  make: upperOptional(60),
  model: upperOptional(60),
  engine_size: textOptional(60),
  unit_number: textOptional(40),
  colour: textOptional(40),
  follow_up_date: dateNullable,
  mileage: z.coerce.number().int().min(0).max(9999999).nullable().optional(),
  carrier_name: textOptional(120),
  comments: textOptional(2000),
  printed_comments: textOptional(2000),
  vehicle_comments: textOptional(2000),
});
export type CreateVehicleInput = z.infer<typeof CreateVehicleInput>;

export const UpdateVehicleInput = CreateVehicleInput.extend({
  id: z.string().uuid(),
});
export type UpdateVehicleInput = z.infer<typeof UpdateVehicleInput>;

export const DeactivateVehicleInput = z.object({ id: z.string().uuid() });

export const SearchVehiclesInput = z.object({
  q: z.string().trim().max(40).default(""),
  customer_id: z.string().uuid().nullable().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
