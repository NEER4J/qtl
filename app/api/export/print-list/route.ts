import { getPrintList } from "@/lib/actions/pricing";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET() {
  // Same audience as the /pricing/print-list page: anyone signed into the app.
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "portal_customer") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { columns, rows, effective_date, company_name } = await getPrintList();

  // Column headers mirror the two-line table head ("T6" over "Gallon"), and
  // duplicate labels are possible (same oil, gallon + bulk), so the CSV key is
  // the column's stable key and the header row is written out separately.
  const headers = ["Engine", "Capacity (L)", ...columns.map((c) => `${c.label} ${c.sublabel}`)];
  const keys = ["engine", "capacity", ...columns.map((_, i) => `c${i}`)];

  const body = toCsv(
    rows.map((r) => ({
      engine: r.engine_name,
      capacity: r.oil_capacity_litres.toFixed(1),
      ...Object.fromEntries(columns.map((_, i) => [`c${i}`, r.prices[i] ?? ""])),
    })),
    keys,
  );

  // Swap the key-based header line toCsv emitted for the human labels
  // (toCsv with no rows gives us the same escaping for free).
  const headerLine = toCsv([], headers).trimEnd();

  const sections = [
    `# ${company_name} — oil change price list`,
    effective_date ? `# Effective ${effective_date}` : `# Effective date not set`,
    `# Exported ${todayISO()}\n`,
    [headerLine, ...body.split("\n").slice(1)].join("\n"),
  ];

  return csvResponse(
    `price-list-${todayISO()}.csv`,
    sections.join("\n"),
  );
}
