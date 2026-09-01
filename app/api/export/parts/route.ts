import { listAllParts } from "@/lib/actions/pricing";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Same audience as the Parts catalogue admin page.
  const profile = await getCurrentProfile();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (profile.role !== "owner" && profile.role !== "co_owner") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  // Mirrors the page's filter bar — the export matches what's on screen.
  const parts = await listAllParts({
    q: url.searchParams.get("q") ?? undefined,
    category_id: url.searchParams.get("category_id") ?? undefined,
    brand: url.searchParams.get("brand") ?? undefined,
    status: url.searchParams.get("status") === "inactive" ? "inactive" : "active",
  });

  const rows = parts.map((p) => ({
    part_number: p.part_number,
    brand: p.brand,
    category: p.category,
    description: p.description,
    service: p.service_cost_name,
    cost: p.cost,
    mhsw_sell: p.mhsw_fee,
    mhsw_buy: p.mhsw_buy,
    margin: p.margin_type === "percent" ? `${p.margin_value}%` : p.margin_value,
    list_price: p.list_price,
    taxable: p.is_taxable ? "yes" : "no",
    active: p.active ? "yes" : "no",
  }));

  return csvResponse(
    `parts-catalogue-${todayISO()}.csv`,
    toCsv(rows as unknown as Record<string, unknown>[], [
      "part_number",
      "brand",
      "category",
      "description",
      "service",
      "cost",
      "mhsw_sell",
      "mhsw_buy",
      "margin",
      "list_price",
      "taxable",
      "active",
    ]),
  );
}
