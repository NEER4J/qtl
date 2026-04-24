import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllOilTypes, listVolumeTiers } from "@/lib/actions/pricing";

import { VolumeTiersByOil } from "./volume-tiers-by-oil";

export const dynamic = "force-dynamic";

export default async function VolumeTiersPage() {
  await requireRole("owner");
  const [oilTypes, tiers] = await Promise.all([listAllOilTypes(), listVolumeTiers()]);

  const tiersByOil = new Map<string, typeof tiers>();
  for (const t of tiers) {
    const arr = tiersByOil.get(t.oil_type_id) ?? [];
    arr.push(t);
    tiersByOil.set(t.oil_type_id, arr);
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Volume tiers</h1>
        <p className="text-sm text-muted-foreground">
          Flat premiums added to oil-change prices based on engine oil capacity, per oil type.
        </p>
      </div>

      <PageHelp id="settings-pricing-volume-tiers">
        <p>
          For each oil type, define one or more brackets keyed by the minimum oil capacity. When pricing
          an oil change, the system looks up the highest bracket whose <em>min L</em> is ≤ the engine&apos;s
          oil capacity, and adds that bracket&apos;s premium.
        </p>
        <ul>
          <li>Set <strong>min_litres = 0</strong> as a default bracket that catches small engines.</li>
          <li>Higher-grade oils (synthetic) typically carry higher premiums — define them per oil type.</li>
          <li>Delete a tier to remove it. No active/inactive flag — tiers are simple lookup rows.</li>
        </ul>
      </PageHelp>

      {oilTypes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">No oil types yet.</p>
            <p>Add oil types first — volume tiers are defined per oil type.</p>
            <Button asChild variant="outline">
              <Link href="/settings/pricing/oil-types">Go to oil types</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {oilTypes.map((oil) => (
            <VolumeTiersByOil
              key={oil.id}
              oilType={oil}
              tiers={tiersByOil.get(oil.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
