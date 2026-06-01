import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" ? Number(v) : v))
  .pipe(z.number().finite().nonnegative());

export const dateSchema = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"));

export const paymentModeSchema = z.enum([
  "visa",
  "mastercard",
  "debit",
  "cash",
  "cheque",
  "etransfer",
  "oc",
  "credit_card",
]);

export const paymentStatusSchema = z.enum(["paid", "partial", "outstanding"]);

export const userRoleSchema = z.enum([
  "owner",
  "co_owner",
  "manager",
  "supervisor",
  "accountant",
  "staff",
  "technician",
  "employee",
  "portal_customer",
]);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;
