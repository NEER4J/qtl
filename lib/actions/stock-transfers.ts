"use server";

// Stock transfers between locations, at cost (client call 2026-11-19).
// The row is the record; the database trigger (migration 0167) moves the
// stock. Rows are never edited — a mistake is undone by a transfer back.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import { canAccessLocation } from "@/lib/auth/locations";
import { requirePage } from "@/lib/auth/require";
import { uuidSchema } from "@/lib/schemas/common";
import { isMhswCategoryName } from "@/lib/utils/mhsw";
import { todayISO } from "@/lib/utils/tz";

export interface StockTransferRow {
  id: string;
  transfer_date: string;
  from_location: string;
  to_location: string;
  item: string;
  kind: "part" | "oil";
  quantity: number;
  unit_cost: number;
  value: number;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

function isMissingRelation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "PGRST205" || code === "42P01";
}

/** null = the table isn't there yet (before migration 0167). */
export async function listStockTransfers(limit = 200): Promise<StockTransferRow[] | null> {
  await requirePage("inventory");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_transfers")
    .select(
      "id, transfer_date, quantity, unit_cost, notes, created_at, created_by, from:from_location_id(name), to:to_location_id(name), parts:part_id(brand, part_number), oil_types:oil_type_id(code, name)",
    )
    .order("transfer_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }

  type Name = { name: string | null } | { name: string | null }[] | null;
  type Row = {
    id: string;
    transfer_date: string;
    quantity: number;
    unit_cost: number;
    notes: string | null;
    created_at: string;
    created_by: string | null;
    from: Name;
    to: Name;
    parts: { brand: string; part_number: string } | { brand: string; part_number: string }[] | null;
    oil_types: { code: string; name: string } | { code: string; name: string }[] | null;
  };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const rows = (data ?? []) as unknown as Row[];

  // Names of who entered each one (created_by -> auth.users, so no embed).
  const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of people ?? []) names.set(p.id as string, (p.full_name as string) ?? "");
  }

  return rows.map((r) => {
    const part = one(r.parts);
    const oil = one(r.oil_types);
    const qty = Number(r.quantity) || 0;
    const cost = Number(r.unit_cost) || 0;
    return {
      id: r.id,
      transfer_date: r.transfer_date,
      from_location: one(r.from)?.name ?? "—",
      to_location: one(r.to)?.name ?? "—",
      item: part ? `${part.brand} ${part.part_number}` : oil ? `${oil.code} — ${oil.name}` : "—",
      kind: part ? "part" : "oil",
      quantity: qty,
      unit_cost: cost,
      value: Math.round(qty * cost * 100) / 100,
      notes: r.notes,
      created_by_name: r.created_by ? (names.get(r.created_by) ?? null) : null,
      created_at: r.created_at,
    };
  });
}

const CreateStockTransferInput = z
  .object({
    transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required").optional(),
    from_location_id: uuidSchema,
    to_location_id: uuidSchema,
    part_id: uuidSchema.nullable().optional(),
    oil_type_id: uuidSchema.nullable().optional(),
    quantity: z.coerce.number().positive("Quantity must be more than 0").max(1_000_000),
    notes: z.string().trim().max(500).nullable().optional().or(z.literal("")),
  })
  .refine((v) => v.from_location_id !== v.to_location_id, {
    message: "Pick two different locations",
    path: ["to_location_id"],
  })
  .refine((v) => !!v.part_id !== !!v.oil_type_id, {
    message: "Pick a part or an oil",
    path: ["part_id"],
  })
  .refine((v) => !v.part_id || Number.isInteger(v.quantity), {
    message: "Parts move in whole units",
    path: ["quantity"],
  });

export const createStockTransfer = wrapAction({
  schema: CreateStockTransferInput,
  page: "inventory",
  // Same roles that may edit inventory counts (setPartLocationStock); RLS 0167
  // allows the same.
  roles: ["owner", "co_owner", "manager", "supervisor"],
  handler: async (input, profile): Promise<{ id: string }> => {
    if (!canAccessLocation(profile, input.from_location_id)) {
      throw new Error("You can only send stock from a location you work at.");
    }
    const supabase = await createClient();

    // Cost at the time, and how much the sending shop has.
    let unitCost = 0;
    let onHand = 0;
    let label = "";
    if (input.part_id) {
      const [{ data: part, error: pErr }, { data: stock, error: sErr }] = await Promise.all([
        supabase
          .from("parts")
          .select("brand, part_number, cost, part_categories:category_id(name)")
          .eq("id", input.part_id)
          .single(),
        supabase
          .from("part_location_stock")
          .select("qty")
          .eq("part_id", input.part_id)
          .eq("location_id", input.from_location_id)
          .maybeSingle(),
      ]);
      if (pErr) throw pErr;
      if (sErr) throw sErr;
      const cat = (part as { part_categories?: { name: string | null } | { name: string | null }[] | null })
        .part_categories;
      if (isMhswCategoryName(Array.isArray(cat) ? cat[0]?.name : cat?.name)) {
        throw new Error("MHSW is a fee, not stock — there is nothing to transfer.");
      }
      unitCost = Number(part.cost) || 0;
      onHand = Number(stock?.qty) || 0;
      label = `${part.brand} ${part.part_number}`;
    } else {
      const [{ data: oil, error: oErr }, { data: stock, error: sErr }] = await Promise.all([
        supabase
          .from("oil_types")
          .select("code, bulk_cost_per_litre")
          .eq("id", input.oil_type_id!)
          .single(),
        supabase
          .from("oil_location_stock")
          .select("qty")
          .eq("oil_type_id", input.oil_type_id!)
          .eq("location_id", input.from_location_id)
          .maybeSingle(),
      ]);
      if (oErr) throw oErr;
      if (sErr) throw sErr;
      unitCost = Number(oil.bulk_cost_per_litre) || 0;
      onHand = Number(stock?.qty) || 0;
      label = `${oil.code} (litres)`;
    }

    if (input.quantity > onHand + 0.0001) {
      throw new Error(
        `Not enough ${label} at the sending location: ${Number(onHand.toFixed(2))} on hand.`,
      );
    }

    const { data, error } = await supabase
      .from("stock_transfers")
      .insert({
        transfer_date: input.transfer_date || todayISO(),
        from_location_id: input.from_location_id,
        to_location_id: input.to_location_id,
        part_id: input.part_id ?? null,
        oil_type_id: input.oil_type_id ?? null,
        quantity: input.quantity,
        unit_cost: unitCost,
        notes: input.notes || null,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error) {
      if (isMissingRelation(error)) {
        throw new Error("Transfers aren't switched on yet — the database update (0167) needs applying.");
      }
      throw error;
    }

    revalidatePath("/inventory");
    revalidatePath("/inventory/transfers");
    return { id: data.id as string };
  },
});
