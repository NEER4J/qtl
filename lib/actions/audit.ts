"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/require";
import type { AuditLogRow } from "@/lib/db/types";

export interface AuditLogFilter {
  table_name?: string;
  record_id?: string;
  actor_id?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogResult {
  rows: AuditLogRow[];
  total: number;
}

export async function listAuditLog(filter: AuditLogFilter = {}): Promise<AuditLogResult> {
  const profile = await requireProfile();
  if ((profile.role !== "owner" && profile.role !== "co_owner") && profile.role !== "accountant") {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("at", { ascending: false })
    .range(from, to);

  if (filter.table_name) q = q.eq("table_name", filter.table_name);
  if (filter.record_id) q = q.eq("record_id", filter.record_id);
  if (filter.actor_id) q = q.eq("actor_id", filter.actor_id);
  if (filter.action) q = q.eq("action", filter.action);
  if (filter.from) q = q.gte("at", filter.from);
  if (filter.to) q = q.lte("at", filter.to + "T23:59:59Z");

  const { data, error, count } = await q;
  if (error) throw error;

  return { rows: (data ?? []) as AuditLogRow[], total: count ?? 0 };
}
