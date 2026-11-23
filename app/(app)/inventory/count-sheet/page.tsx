import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/pricing/print-button";
import { requirePage } from "@/lib/auth/require";
import { accessibleLocationIds } from "@/lib/auth/locations";
import { listInventory, listOilInventory } from "@/lib/actions/inventory";
import { formatDate } from "@/lib/utils/format";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

/**
 * Monthly stock-count sheet (client call 2026-11-19): the old program printed
 * the inventory list and staff wrote the count by hand beside each part
 * number — no min / max on it. One location per sheet; the system's on-hand
 * is left off so the count is a real count, not a copy.
 *
 *   ?location=<id>   which shop (defaults to the first one the user can see)
 *   ?all=1           every active part, not only the ones this shop stocks
 */
export default async function InventoryCountSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; all?: string }>;
}) {
  const profile = await requirePage("inventory");
  const sp = await searchParams;
  const [data, oilData] = await Promise.all([listInventory(), listOilInventory()]);

  const allowed = accessibleLocationIds(profile);
  const locations = data.locations.filter((l) => !allowed || allowed.includes(l.id));
  const location = locations.find((l) => l.id === sp.location) ?? locations[0] ?? null;
  const showAll = sp.all === "1";

  // "Stocked here" = on hand at this shop (either sign) or a min / max set
  // for it. Parts this shop never carries would only pad the sheet.
  const stockedHere = (row: {
    qtyByLocation: Record<string, number>;
    limitsByLocation: Record<string, { min: number | null; max: number | null }>;
  }) =>
    !!location &&
    ((row.qtyByLocation[location.id] ?? 0) !== 0 ||
      row.limitsByLocation[location.id]?.min != null ||
      row.limitsByLocation[location.id]?.max != null);

  const parts = data.parts
    .filter((p) => showAll || stockedHere(p))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        a.part_number.localeCompare(b.part_number, undefined, { numeric: true }),
    );
  const oils = oilData.oils.filter((o) => showAll || stockedHere(o));

  // Category headings between groups.
  const groups: { category: string; rows: typeof parts }[] = [];
  for (const p of parts) {
    const cat = p.category || "Uncategorised";
    const last = groups[groups.length - 1];
    if (last && last.category === cat) last.rows.push(p);
    else groups.push({ category: cat, rows: [p] });
  }

  const href = (locId: string, all: boolean) =>
    `/inventory/count-sheet?location=${locId}${all ? "&all=1" : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <style>{"@media print { @page { size: portrait; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/inventory">
              <ChevronLeft className="size-4" /> Back to inventory
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Count sheet</h1>
          <p className="text-sm text-muted-foreground">
            Print it, count each shelf and write the number in the Count column. Then type the
            counts into Inventory.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-sm text-muted-foreground">Location:</span>
        {locations.map((l) => (
          <Button
            key={l.id}
            asChild
            size="sm"
            variant={l.id === location?.id ? "default" : "outline"}
          >
            <Link href={href(l.id, showAll)}>{l.name}</Link>
          </Button>
        ))}
        <span className="mx-2 h-5 w-px bg-border" />
        {location && (
          <Button asChild size="sm" variant="outline">
            <Link href={href(location.id, !showAll)}>
              {showAll ? "Only parts stocked here" : "Every part in the catalogue"}
            </Link>
          </Button>
        )}
      </div>

      {!location ? (
        <p className="text-sm text-muted-foreground">No location to count.</p>
      ) : (
        <div className="text-sm">
          <div className="mb-3 flex items-end justify-between border-b pb-2">
            <div>
              <div className="text-xl font-bold">Stock count: {location.name}</div>
              <div className="text-xs text-muted-foreground">
                {showAll ? "Every active part" : "Parts and oils stocked at this location"} ·{" "}
                {parts.length} part{parts.length === 1 ? "" : "s"}
                {oils.length > 0 ? ` · ${oils.length} oil${oils.length === 1 ? "" : "s"}` : ""} ·
                printed {formatDate(todayISO())}
              </div>
            </div>
            <div className="text-xs">
              Counted by: ______________________ &nbsp; Date: ____________
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="w-10 py-1 pr-2 font-semibold">#</th>
                <th className="py-1 pr-2 font-semibold">Part #</th>
                <th className="py-1 pr-2 font-semibold">Brand</th>
                <th className="py-1 pr-2 font-semibold">Description</th>
                <th className="w-28 py-1 font-semibold text-center">Count</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let n = 0;
                return groups.map((g) => [
                  <tr key={`h-${g.category}`} className="break-inside-avoid">
                    <td colSpan={5} className="pt-3 pb-1 text-xs font-bold uppercase tracking-wide">
                      {g.category}
                    </td>
                  </tr>,
                  ...g.rows.map((p) => {
                    n += 1;
                    return (
                      <tr key={p.id} className="border-b border-muted-foreground/30 break-inside-avoid">
                        <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{n}</td>
                        <td className="py-1.5 pr-2 font-medium">{p.part_number}</td>
                        <td className="py-1.5 pr-2">{p.brand}</td>
                        <td className="py-1.5 pr-2 text-xs">{p.description ?? ""}</td>
                        <td className="py-1.5">
                          <div className="mx-auto h-6 w-24 border border-foreground/60" />
                        </td>
                      </tr>
                    );
                  }),
                ]);
              })()}
              {oils.length > 0 && (
                <>
                  <tr className="break-inside-avoid">
                    <td colSpan={5} className="pt-4 pb-1 text-xs font-bold uppercase tracking-wide">
                      Oil (litres)
                    </td>
                  </tr>
                  {oils.map((o, i) => (
                    <tr key={o.id} className="border-b border-muted-foreground/30 break-inside-avoid">
                      <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{parts.length + i + 1}</td>
                      <td className="py-1.5 pr-2 font-medium">{o.code}</td>
                      <td className="py-1.5 pr-2" colSpan={2}>{o.name}</td>
                      <td className="py-1.5">
                        <div className="mx-auto h-6 w-24 border border-foreground/60" />
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
