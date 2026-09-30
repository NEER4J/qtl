import { listInventory, listOilInventory } from "@/lib/actions/inventory";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { isActionAllowed } from "@/lib/permissions/check";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { locationsWithStatus, type StockLimit } from "@/lib/utils/stock-limits";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "portal_customer") {
    return new Response("Unauthorized", { status: 401 });
  }
  // Was "anyone signed into the app", which made the hidden button pointless —
  // the CSV was one URL away. Now gated on `inventory.export`, which also
  // requires the `inventory` page.
  if (!isActionAllowed(profile, "inventory.export")) {
    return new Response("Forbidden", { status: 403 });
  }

  const [inv, oil] = await Promise.all([listInventory(), listOilInventory()]);

  const sections: string[] = [];
  sections.push(`# Inventory — on-hand stock by location`);
  sections.push(`# Exported ${todayISO()}\n`);

  // Per location: on hand, then that shop's own min and max (0151). Status
  // names the shops that are below their minimum or above their maximum.
  type Row = {
    qtyByLocation: Record<string, number>;
    limitsByLocation: Record<string, StockLimit>;
    total: number;
  };
  const locationColumns = (locations: { id: string; name: string }[]) =>
    locations.flatMap((l) => [l.name, `${l.name} min`, `${l.name} max`]);
  const locationCells = (row: Row, locations: { id: string; name: string }[]) =>
    Object.fromEntries(
      locations.flatMap((l) => [
        [l.name, row.qtyByLocation[l.id] ?? 0],
        [`${l.name} min`, row.limitsByLocation[l.id]?.min ?? null],
        [`${l.name} max`, row.limitsByLocation[l.id]?.max ?? null],
      ]),
    );
  const statusOf = (row: Row, locations: { id: string; name: string }[]) => {
    const names = (ids: string[]) =>
      locations.filter((l) => ids.includes(l.id)).map((l) => l.name).join(" / ");
    const low = names(locationsWithStatus(row, "low"));
    const over = names(locationsWithStatus(row, "over"));
    return [low ? `LOW: ${low}` : "", over ? `OVER: ${over}` : ""].filter(Boolean).join("; ");
  };

  sections.push(`## Parts`);
  sections.push(
    toCsv(
      inv.parts.map((p) => ({
        part_number: p.part_number,
        brand: p.brand,
        category: p.category,
        description: p.description,
        ...locationCells(p, inv.locations),
        total: p.total,
        status: statusOf(p, inv.locations),
      })),
      ["part_number", "brand", "category", "description", ...locationColumns(inv.locations), "total", "status"],
    ),
  );

  sections.push("");
  sections.push(`## Oils (litres)`);
  sections.push(
    toCsv(
      oil.oils.map((o) => ({
        code: o.code,
        name: o.name,
        ...locationCells(o, oil.locations),
        total: o.total,
        status: statusOf(o, oil.locations),
      })),
      ["code", "name", ...locationColumns(oil.locations), "total", "status"],
    ),
  );

  return csvResponse(
    `inventory-${todayISO()}.csv`,
    sections.join("\n"),
  );
}
