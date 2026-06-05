import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";
import { listInventory } from "@/lib/actions/inventory";

import { InventoryTable } from "./inventory-table";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const profile = await requireProfile();
  const data = await listInventory();

  // Editing counts is limited to high-level roles; everyone else is view-only.
  const canEdit =
    profile.role === "owner" || profile.role === "co_owner" || profile.role === "manager";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          On-hand stock by location · {data.parts.length} part
          {data.parts.length !== 1 ? "s" : ""} · {data.locations.length} location
          {data.locations.length !== 1 ? "s" : ""}
        </p>
      </div>

      <PageHelp id="inventory-list">
        <p>
          On-hand stock count for every catalogue part, broken down by location.
          The <strong>Total</strong> column sums all locations.
        </p>
        <ul>
          <li>
            Counts are editable by <strong>Owner, Admin, and Managers</strong>. Everyone
            else can view but not change them.
          </li>
          <li>Type a count and click away (or press Enter) to save that cell.</li>
          <li>Parts themselves are managed under Settings → Pricing Catalogue.</li>
        </ul>
      </PageHelp>

      <InventoryTable data={data} canEdit={canEdit} />
    </div>
  );
}
