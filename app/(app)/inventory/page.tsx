import { PageHelp } from "@/components/help/page-help";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireProfile } from "@/lib/auth/require";
import { listInventory, listOilInventory } from "@/lib/actions/inventory";

import { InventoryTable } from "./inventory-table";
import { OilInventoryTable } from "./oil-inventory-table";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const profile = await requireProfile();
  const [data, oilData] = await Promise.all([listInventory(), listOilInventory()]);

  // Editing counts is limited to high-level roles; everyone else is view-only.
  const canEdit =
    profile.role === "owner" || profile.role === "co_owner" || profile.role === "manager";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          On-hand stock by location · {data.parts.length} part
          {data.parts.length !== 1 ? "s" : ""} · {oilData.oils.length} oil
          {oilData.oils.length !== 1 ? "s" : ""} · {data.locations.length} location
          {data.locations.length !== 1 ? "s" : ""}
        </p>
      </div>

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

      <Tabs defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts">Parts ({data.parts.length})</TabsTrigger>
          <TabsTrigger value="oils">Oils ({oilData.oils.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="parts" className="mt-4">
          <InventoryTable data={data} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="oils" className="mt-4">
          <OilInventoryTable data={oilData} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
