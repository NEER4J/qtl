import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

/**
 * Vercel cron entry — POST /api/cron/process-recurring-expenses
 * Schedule defined in vercel.json. Vercel sends a Bearer token matching
 * the CRON_SECRET env var; reject anything else.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("process_recurring_expenses", {
    as_of: todayISO(),
  });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const generated = (data as unknown[] | null)?.length ?? 0;
  return Response.json({ ok: true, generated, ran_at: new Date().toISOString() });
}
