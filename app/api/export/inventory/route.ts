import { listInventory, listOilInventory } from "@/lib/actions/inventory";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { csvResponse, toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  // Same audience as the /inventory page: anyone signed into the app.
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "portal_customer") {
    return new Response("Unauthorized", { status: 401 });
  }

  const [inv, oil] = await Promise.all([listInventory(), listOilInventory()]);

  const sections: string[] = [];
  sections.push(`# Inventory — on-hand stock by location`);
  sections.push(`# Exported ${new Date().toISOString().slice(0, 10)}\n`);

  const locNames = inv.locations.map((l) => l.name);

  sections.push(`## Parts`);
  sections.push(
    toCsv(
      inv.parts.map((p) => ({
        part_number: p.part_number,
        brand: p.brand,
        category: p.category,
        description: p.description,
        ...Object.fromEntries(
          inv.locations.map((l) => [l.name, p.qtyByLocation[l.id] ?? 0]),
        ),
        total: p.total,
        min: p.min_stock_qty,
        max: p.max_stock_qty,
        status:
          p.min_stock_qty != null && p.total < p.min_stock_qty
            ? "LOW"
            : p.max_stock_qty != null && p.total > p.max_stock_qty
              ? "OVER"
              : "",
      })),
      ["part_number", "brand", "category", "description", ...locNames, "total", "min", "max", "status"],
    ),
  );

  sections.push("");
  sections.push(`## Oils (litres)`);
  sections.push(
    toCsv(
      oil.oils.map((o) => ({
        code: o.code,
        name: o.name,
        ...Object.fromEntries(
          oil.locations.map((l) => [l.name, o.qtyByLocation[l.id] ?? 0]),
        ),
        total: o.total,
        min: o.min_stock_litres,
        max: o.max_stock_litres,
        status:
          o.min_stock_litres != null && o.total < o.min_stock_litres
            ? "LOW"
            : o.max_stock_litres != null && o.total > o.max_stock_litres
              ? "OVER"
              : "",
      })),
      ["code", "name", ...oil.locations.map((l) => l.name), "total", "min", "max", "status"],
    ),
  );

  return csvResponse(
    `inventory-${new Date().toISOString().slice(0, 10)}.csv`,
    sections.join("\n"),
  );
}
