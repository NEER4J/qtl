import { requireProfile } from "@/lib/auth/require";
import { getPayrollWeek } from "@/lib/actions/payroll";
import { getAppSettings } from "@/lib/actions/reference";
import { hiddenColumnsForPage, isPageAllowed } from "@/lib/permissions/check";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { assemblePayStubs, type StubEmployeeInfo, type YtdEntry } from "@/lib/utils/pay-stub";

export const dynamic = "force-dynamic";

/**
 * Pay stubs for one pay week as a PDF (client 2026-10-20): one page per
 * employee, `?entry=<entryId>` for a single stub, `?download=1` to save it.
 * A plain GET so a link can open it straight away (a tab opened after an
 * await is blocked as a pop-up — see the invoice PDF route).
 *
 * Everything is read with the caller's own client, so RLS decides what they
 * get: someone who can't see this week gets a 404, and year-to-date only
 * counts pay weeks they are allowed to see.
 */
export async function GET(req: Request, { params }: { params: Promise<{ weekId: string }> }) {
  const profile = await requireProfile();
  // API routes sit outside the (app) layout's page gate. RLS lets a manager
  // read their shop's payroll rows, but stubs are Payroll-page data.
  if (!isPageAllowed(profile, "payroll")) {
    return new Response("You don't have access to Payroll.", { status: 403 });
  }
  const { weekId } = await params;
  const search = new URL(req.url).searchParams;
  const entryId = search.get("entry");

  const week = await getPayrollWeek(weekId);
  if (!week) return new Response("Pay week not found", { status: 404 });
  const entries = entryId ? week.entries.filter((e) => e.id === entryId) : week.entries;
  if (entries.length === 0) {
    return new Response(entryId ? "Entry not found" : "This week has no entries yet", { status: 404 });
  }

  const supabase = await createClient();
  const employeeIds = [...new Set(entries.map((e) => e.employee_id))];
  // YTD = the calendar year each week is paid in (payYear), up to and
  // including this week, at any shop the employee was paid from. Read from
  // November of the year before: a period starting then can be paid in January.
  const readFrom = `${Number(week.week_start.slice(0, 4)) - 1}-11-01`;

  const [settings, employeesRes, ytdEntries] = await Promise.all([
    getAppSettings(),
    supabase.from("employees").select("id, sin_last4, hire_date").in("id", employeeIds),
    // Paged: a year of weekly entries for a full crew passes the 1,000-row cap.
    fetchAllRows<YtdEntry>((from, to) =>
      supabase
        .from("payroll_entries")
        .select("*, payroll_weeks!inner(*)")
        .in("employee_id", employeeIds)
        .gte("payroll_weeks.week_start", readFrom)
        .lte("payroll_weeks.week_start", week.week_start)
        .order("id")
        .range(from, to),
    ),
  ]);
  if (employeesRes.error) throw employeesRes.error;

  const employees = new Map<string, StubEmployeeInfo>(
    (employeesRes.data ?? []).map((e) => [
      e.id as string,
      { sin_last4: (e.sin_last4 as string | null) ?? null, hire_date: (e.hire_date as string | null) ?? null },
    ]),
  );

  const hidden = hiddenColumnsForPage(profile, "payroll");
  const stubs = assemblePayStubs({
    week,
    companyName: settings.company_name,
    ytdEntries,
    employees,
    show: (key) => !hidden.has(key),
    entryId,
  });

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { buildPayStubDoc } = await import("@/components/pdf/PayStubPdf");
  const single = entryId ? entries[0] : null;
  const title = single
    ? `Pay statement — ${single.employee_name} — ${week.week_start}`
    : `Pay statements — ${week.location_name} — ${week.week_start}`;
  const buffer = await renderToBuffer(buildPayStubDoc(stubs, { title }));

  const slug = (s: string) => s.replace(/[^A-Za-z0-9-_]+/g, "_").replace(/^_+|_+$/g, "");
  const filename = single
    ? `pay-stub-${week.week_start}-${slug(single.employee_name) || "employee"}.pdf`
    : `pay-stubs-${slug(week.location_code || week.location_name) || "week"}-${week.week_start}.pdf`;
  const download = search.get("download") === "1";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
