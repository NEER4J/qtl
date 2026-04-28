import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllEngineTypes } from "@/lib/actions/pricing";

import { EngineTypesTable } from "./engine-types-table";

export const dynamic = "force-dynamic";

export default async function EngineTypesPage() {
  await requireRole("owner");
  const engineTypes = await listAllEngineTypes();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Engine types</h1>
        <p className="text-sm text-muted-foreground">
          Each engine&apos;s oil capacity and the filter set installed on it.
        </p>
      </div>

      <PageHelp id="settings-pricing-engine-types">
        <p>
          Each engine is a row on the oil-change grid. Two things drive the row&apos;s prices: the
          <strong> oil capacity</strong> (multiplied by the oil cost per litre) and the
          <strong> filter set</strong> installed on the engine (each filter&apos;s part cost + MHSW fee + linked labour).
        </p>
        <ul>
          <li>Click an engine to edit its filter set (which parts and how many of each).</li>
          <li>The unique key is <em>manufacturer + model</em>. Deactivate instead of deleting if the engine is retired.</li>
          <li>Changing the oil capacity or filter set recomputes every cell in that row.</li>
        </ul>
      </PageHelp>

      <EngineTypesTable engineTypes={engineTypes} />
    </div>
  );
}
