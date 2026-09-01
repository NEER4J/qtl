import { Download, TriangleAlert } from "lucide-react";

import { PageHelp } from "@/components/help/page-help";
import { PrintButton } from "@/components/pricing/print-button";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireProfile } from "@/lib/auth/require";
import { listInventory, listOilInventory } from "@/lib/actions/inventory";
import { formatDate } from "@/lib/utils/format";

import { InventoryTable } from "./inventory-table";
import { OilInventoryTable } from "./oil-inventory-table";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const profile = await requireProfile();
  const [data, oilData] = await Promise.all([listInventory(), listOilInventory()]);

  // Editing counts is limited to high-level roles; everyone else is view-only.
  const canEdit =
    profile.role === "owner" || profile.role === "co_owner" || profile.role === "manager";
  // Min/max thresholds are policy — parts_write / oil_types_write RLS is
  // owner-only (co_owner via the 0124 alias).
  const canEditLimits = profile.role === "owner" || profile.role === "co_owner";

  const lowParts = data.parts.filter(
    (p) => p.min_stock_qty != null && p.total < p.min_stock_qty,
  ).length;
  const lowOils = oilData.oils.filter(
    (o) => o.min_stock_litres != null && o.total < o.min_stock_litres,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Print in landscape with the chrome hidden — same pattern as the
          pricing print pages. Only the tab currently on screen prints. */}
      <style>{"@media print { @page { size: landscape; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            On-hand stock by location · {data.parts.length} part
            {data.parts.length !== 1 ? "s" : ""} · {oilData.oils.length} oil
            {oilData.oils.length !== 1 ? "s" : ""} · {data.locations.length} location
            {data.locations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/export/inventory" download>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
          <PrintButton />
        </div>
      </div>

      {/* Print header — only visible in print */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Inventory — on-hand stock</h1>
        <p className="text-xs">Printed {formatDate(todayISO())}</p>
      </div>

      <div className="print:hidden">
      <PageHelp id="inventory-list">
        <p>
          On-hand stock by location for every catalogue <strong>part</strong> and{" "}
          <strong>oil</strong>. Switch tabs to manage each. The <strong>Total</strong> column
          sums all locations.
        </p>
        <ul>
          <li>
            Counts are editable by <strong>Owner, Admin, and Managers</strong>. Everyone
            else can view but not change them.
          </li>
          <li>Type a count and click away (or press Enter) to save that cell.</li>
          <li>Oil stock is tracked in <strong>litres</strong> (fractional allowed).</li>
          <li>Parts and oils themselves are managed under Settings → Pricing Catalogue.</li>
        </ul>
      </PageHelp>
      </div>

      {(lowParts > 0 || lowOils > 0) && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 print:hidden">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Low stock:</strong>{" "}
            {[
              lowParts > 0 ? `${lowParts} part${lowParts === 1 ? "" : "s"}` : null,
              lowOils > 0 ? `${lowOils} oil${lowOils === 1 ? "" : "s"}` : null,
            ]
              .filter(Boolean)
              .join(" and ")}{" "}
            below the minimum level — tick <strong>Low stock only</strong> in the table to see
            what needs reordering.
          </span>
        </div>
      )}

      <Tabs defaultValue="parts">
        <TabsList className="print:hidden">
          <TabsTrigger value="parts">
            Parts ({data.parts.length}){lowParts > 0 ? ` · ${lowParts} low` : ""}
          </TabsTrigger>
          <TabsTrigger value="oils">
            Oils ({oilData.oils.length}){lowOils > 0 ? ` · ${lowOils} low` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="parts" className="mt-4">
          <InventoryTable data={data} canEdit={canEdit} canEditLimits={canEditLimits} />
        </TabsContent>
        <TabsContent value="oils" className="mt-4">
          <OilInventoryTable data={oilData} canEdit={canEdit} canEditLimits={canEditLimits} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
