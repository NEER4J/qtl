import { z } from "zod";
import { dateSchema, moneySchema } from "@/lib/schemas/common";

export const RecurringExpenseInput = z.object({
  location_id: z.string().uuid("Select a location"),
  category_id: z.string().uuid("Select a category"),
  subcategory_id: z.string().uuid().nullable().optional(),
  vendor_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(200).nullable().optional().or(z.literal("")),
  amount: moneySchema.refine((v) => v > 0, "Amount must be greater than zero"),
  hst_rate: z.coerce.number().min(0).max(1).default(0.13),
  frequency: z.enum(["monthly", "weekly", "annual"]),
  day_of_month: z.coerce.number().int().min(1).max(28).nullable().optional(),
  day_of_week: z.coerce.number().int().min(0).max(6).nullable().optional(),
  start_date: dateSchema,
  end_date: dateSchema.nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
}).superRefine((v, ctx) => {
  if (v.frequency === "weekly" && v.day_of_week == null) {
    ctx.addIssue({ code: "custom", path: ["day_of_week"], message: "Day of week required" });
  }
  if ((v.frequency === "monthly" || v.frequency === "annual") && v.day_of_month == null) {
    ctx.addIssue({ code: "custom", path: ["day_of_month"], message: "Day of month required" });
  }
});
export type RecurringExpenseInput = z.infer<typeof RecurringExpenseInput>;

export const UpdateRecurringExpenseInput = z.object({ id: z.string().uuid() }).and(RecurringExpenseInput);
export type UpdateRecurringExpenseInput = z.infer<typeof UpdateRecurringExpenseInput>;
