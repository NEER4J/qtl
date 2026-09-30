import { Download, TriangleAlert } from "lucide-react";

import { PageHelp } from "@/components/help/page-help";
import { PrintButton } from "@/components/pricing/print-button";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireProfile } from "@/lib/auth/require";
import { isActionAllowed } from "@/lib/permissions/check";
import { listInventory, listOilInventory } from "@/lib/actions/inventory";
import { formatDate } from "@/lib/utils/format";
import { isLowAnywhere } from "@/lib/utils/stock-limits";

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
  // Min/max thresholds are policy — part_location_limits / oil_location_limits
  // RLS is owner + co_owner only.
  const canEditLimits = profile.role === "owner" || profile.role === "co_owner";
  // `inventory.export` from the action registry — /api/export/inventory
  // enforces the same check, so hiding the button is presentation only.
  const canExport = isActionAllowed(profile, "inventory.export");

  // Low = below its minimum at one location or more. Each shop is checked
  // against its own threshold; stock at another shop doesn't cover it.
  const lowParts = data.parts.filter(isLowAnywhere).length;
  const lowOils = oilData.oils.filter(isLowAnywhere).length;

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
          {canExport && (
            <Button asChild variant="outline" size="sm">
              <a href="/api/export/inventory" download>
                <Download className="size-4" /> Export CSV
              </a>
            </Button>
          )}
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
          <li>
            <strong>Min</strong> and <strong>Max</strong> are set <strong>per location</strong>,
            beside that location&apos;s count, by the Owner or Admin. A count below its own
            shop&apos;s Min is flagged <strong>Low</strong>, above its Max <strong>Over</strong> —
            stock at another location doesn&apos;t count toward it. Leave a box empty for no
            threshold.
          </li>
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
            below the minimum at one location or more — tick <strong>Low stock only</strong> in
            the table to see what needs reordering, and where.
          </span>
        </div>
      )}

      {canEditLimits && !data.limits_supported && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 print:hidden">
          Min / max levels are now set per location. Apply{" "}
          <span className="font-mono text-xs">migration 0151</span> to turn them on — until then
          the Min and Max columns are empty.
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
