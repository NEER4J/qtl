import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import {
  engineLabourPackageSupported,
  listAllEngineTypes,
  listLabourPackageOptions,
} from "@/lib/actions/pricing";

import { EngineTypesTable } from "./engine-types-table";

export const dynamic = "force-dynamic";

export default async function EngineTypesPage() {
  await requireRole("owner", "co_owner");
  const [engineTypes, labourPackages, labourLinkSupported] = await Promise.all([
    listAllEngineTypes(),
    listLabourPackageOptions(),
    engineLabourPackageSupported(),
  ]);
  const unlinked = labourLinkSupported
    ? engineTypes.filter((e) => e.active && !e.labour_package_id).length
    : 0;

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
          <li>
            <strong>Labour package</strong> — the package whose <em>Labor charge</em> is this
            engine&apos;s oil-change labour. It&apos;s what the Labour column on the oil-detail
            page reads. Engine and package names don&apos;t line up reliably, so the link is set
            here; an unlinked engine falls back to the summed part labour instead, which is
            usually not the package price.
          </li>
        </ul>
      </PageHelp>

      {unlinked > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>{unlinked}</strong> active engine{unlinked === 1 ? " has" : "s have"} no labour
          package linked — the oil-detail Labour column falls back to the summed part labour for
          {unlinked === 1 ? " it" : " them"}. Pick the package in the{" "}
          <strong>Labour package</strong> column below.
        </div>
      )}

      <EngineTypesTable
        engineTypes={engineTypes}
        labourPackages={labourPackages}
        labourLinkSupported={labourLinkSupported}
      />
    </div>
  );
}
