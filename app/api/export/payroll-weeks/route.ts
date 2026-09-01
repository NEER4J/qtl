import { resolveLocationFilter } from "@/lib/auth/locations";
import { listPayrollWeeks } from "@/lib/actions/payroll";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

/** The pay-week list with its per-week roll-ups — the payroll page as a sheet. */
export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "portal_customer") {
    return new Response("Unauthorized", { status: 401 });
  }

  const requested = new URL(req.url).searchParams.get("location_id");
  // Clamp to what this user may see — a hand-typed location_id in the query
  // string can never widen the export beyond their granted shops.
  const { ids: locationIds } = resolveLocationFilter(profile, requested);

  const weeks = await listPayrollWeeks(locationIds);

  const sections: string[] = [];
  sections.push(`# Payroll — pay weeks`);
  sections.push(`# Exported,${todayISO()}\n`);
  sections.push(
    toCsv(
      weeks.map((w) => ({
        week_start: w.week_start,
        week_end: w.week_end,
        location: w.location_name,
        status: w.status,
        employees: w.entry_count,
        gross: w.total_gross.toFixed(2),
        deductions: w.total_deductions.toFixed(2),
        net_pay: w.total_net.toFixed(2),
        employer_cost: w.total_employer_cost.toFixed(2),
        vacation_accrued: w.total_vacation_pay.toFixed(2),
        cash: w.total_cash.toFixed(2),
        paid: w.total_paid.toFixed(2),
      })),
      [
        "week_start",
        "week_end",
        "location",
        "status",
        "employees",
        "gross",
        "deductions",
        "net_pay",
        "employer_cost",
        "vacation_accrued",
        "cash",
        "paid",
      ],
    ),
  );

  return csvResponse(`payroll-weeks-${todayISO()}.csv`, sections.join("\n"));
}
