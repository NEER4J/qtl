import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { isPageAllowed } from "@/lib/permissions/check";
import { BACKUP_TABLE_BY_NAME } from "@/lib/utils/backup-tables";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 1000; // PostgREST's row cap per request
const PARALLEL = 6;

function cell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * One table of the Admin's backup as CSV: /api/export/backup?table=sales_jobs.
 * Streamed page by page, so a 130k-row table never sits in memory whole or
 * hits the response-size limit. Gated on the Backup settings page.
 */
export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "portal_customer") {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isPageAllowed(profile, "settings_backup")) {
    return new Response("Forbidden", { status: 403 });
  }
  const name = new URL(req.url).searchParams.get("table") ?? "";
  const table = BACKUP_TABLE_BY_NAME.get(name);
  if (!table) return new Response("Unknown table", { status: 404 });

  const supabase = await createClient();
  const { count, error: countErr } = await supabase
    .from(table.name)
    .select("*", { count: "exact", head: true });
  if (countErr) {
    // A table that isn't there yet (a migration not applied) is an empty file.
    if (countErr.code === "PGRST205" || countErr.code === "42P01") {
      return csv(table.name, "");
    }
    return new Response(`Could not read ${table.name}: ${countErr.message}`, { status: 500 });
  }
  const total = count ?? 0;
  const pages = Math.ceil(total / PAGE);

  const fetchPage = async (i: number) => {
    let q = supabase.from(table.name).select("*");
    for (const col of table.order) q = q.order(col, { ascending: true });
    const { data, error } = await q.range(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  };

  const enc = new TextEncoder();
  let columns: string[] | null = null;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let start = 0; start < pages; start += PARALLEL) {
          const batch = await Promise.all(
            Array.from({ length: Math.min(PARALLEL, pages - start) }, (_, k) => fetchPage(start + k)),
          );
          for (const rows of batch) {
            if (rows.length === 0) continue;
            if (!columns) {
              columns = Object.keys(rows[0]!);
              controller.enqueue(enc.encode(columns.map(cell).join(",") + "\n"));
            }
            const cols = columns;
            controller.enqueue(
              enc.encode(rows.map((r) => cols.map((c) => cell(r[c])).join(",")).join("\n") + "\n"),
            );
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qtl-backup-${todayISO()}-${table.name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function csv(name: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qtl-backup-${todayISO()}-${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
