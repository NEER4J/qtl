import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { requirePage } from "@/lib/auth/require";
import { getEngineTypeDetail, listLabourPackageOptions } from "@/lib/actions/pricing";

import { EngineDetailHeader } from "./engine-detail-header";
import { EngineFilterOptionsEditor } from "./engine-filter-options-editor";
import { EngineFiltersEditor } from "./engine-filters-editor";

export const dynamic = "force-dynamic";

export default async function EngineTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePage("settings_pricing");
  const { id } = await params;
  const [detail, packages] = await Promise.all([
    getEngineTypeDetail(id),
    listLabourPackageOptions(),
  ]);
  if (!detail) notFound();

  const { engine, filters, options } = detail;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/settings/pricing/engine-types">
            <ChevronLeft className="size-4" /> Back to engines
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{engine.display_name}</h1>
            <Badge variant={engine.active ? "default" : "secondary"}>
              {engine.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Oil capacity {Number(engine.oil_capacity_litres).toFixed(2)} L · Sort {engine.sort_order}
          </p>
        </div>
        <EngineDetailHeader engine={engine} />
      </div>

      <PageHelp id="settings-pricing-engine-detail">
        <p>
          The <strong>filters on this engine</strong> are added into every oil-change price for this row.
          For each filter, the cost is <em>(part cost + MHSW fee + linked labour) × quantity</em>.
        </p>
        <ul>
          <li>Add any part you stock. Typical sets are oil + fuel + air, sometimes plus cabin / coolant / DEF.</li>
          <li>Quantity is usually 1. Some engines use two of the same filter — bump the quantity instead of adding a duplicate row.</li>
          <li>Edits here change the row&apos;s prices on the oil-change grid immediately.</li>
          <li>
            The <strong>Oil detail</strong> page takes filter cost from the package linked to this
            engine instead (its filter items, at the package&apos;s quantities), and only uses the
            filters here when the package lists none. Keep the two in step.
          </li>
          <li>
            <strong>Filter options</strong> — for an engine sold with a choice of filter brand
            (Cat or Fleetguard, say). It stays one engine; each option is a package, and gets its
            own row and its own prices on the oil-change grid, oil detail, print list and sales
            form. An engine sold one way has none.
          </li>
        </ul>
      </PageHelp>

      {detail.options_supported && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter options</CardTitle>
          </CardHeader>
          <CardContent>
            <EngineFilterOptionsEditor engine={engine} options={options} packages={packages} />
          </CardContent>
        </Card>
      )}

      {options.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters on this engine</CardTitle>
          </CardHeader>
          <CardContent>
            <EngineFiltersEditor
              engineId={engine.id}
              filters={filters.filter((f) => !f.engine_option_id)}
            />
          </CardContent>
        </Card>
      ) : (
        options.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <CardTitle className="text-base">Filters — {o.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <EngineFiltersEditor
                engineId={engine.id}
                optionId={o.id}
                filters={filters.filter((f) => f.engine_option_id === o.id)}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
