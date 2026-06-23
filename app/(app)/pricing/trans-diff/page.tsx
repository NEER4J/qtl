import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { PrintButton } from "@/components/pricing/print-button";
import { requireProfile } from "@/lib/auth/require";
import { listOilTypes, listTransmissionServices } from "@/lib/actions/pricing";

import { TransDiffManager } from "./trans-diff-manager";

export const dynamic = "force-dynamic";

export default async function TransDiffPage() {
  const profile = await requireProfile();
  const [{ groups }, oilTypes] = await Promise.all([
    listTransmissionServices(),
    listOilTypes(),
  ]);
  // Cost-side data (labour breakdown for coolant flush) is admin only —
  // staff and manager at the counter see sell prices only.
  const showCost =
    profile.role === "owner" || profile.role === "co_owner" || profile.role === "accountant";
  // Only owner / co_owner can edit the catalogue (matches the table's RLS).
  const canEdit = profile.role === "owner" || profile.role === "co_owner";

  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <style>{"@media print { @page { margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trans & Diff</h1>
          <p className="text-sm text-muted-foreground">
            {totalRows} service{totalRows === 1 ? "" : "s"} · transmission, differential, and coolant flush pricing
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Trans &amp; Diff price list</h1>
        <p className="text-xs">{totalRows} service{totalRows === 1 ? "" : "s"}</p>
      </div>

      <div className="print:hidden">
      <PageHelp id="pricing-trans-diff">
        <p>
          Flat-priced services from the Excel <span className="font-mono">Trans &amp; Diff</span> tab.
          Each row has a hand-set sell price. Regular vs Synthetic prices live in the same table — the
          badge in the right column tells you which.
        </p>
        <ul>
          <li><strong>Allison Trans</strong> — 2500 / 4500 / 4500 Dump, regular-oil prices.</li>
          <li><strong>Trans / Diff</strong> — standalone transmission or differential oil change. Single = 1 axle, dual = 2.</li>
          <li><strong>Combined</strong> — trans + diff in one visit (saves on labour).</li>
          <li><strong>Specialty Transmission</strong> — DT12 and I-Shift use their own synthetic oils.</li>
          <li><strong>Coolant Flush</strong> — 10 L coolant + $125 labour. Three coolant choices.</li>
        </ul>
        {canEdit && (
          <p>
            Use <strong>Edit</strong> on a row to change a price, or <strong>New service</strong> to add one.
          </p>
        )}
      </PageHelp>
      </div>

      {groups.length === 0 && !canEdit ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-sm text-muted-foreground text-center space-y-2">
            <p className="font-medium text-foreground">No transmission services configured yet.</p>
            <p>
              Apply{" "}
              <span className="font-mono text-xs">supabase/seed/may2026_transmission_services.sql</span>{" "}
              to seed the May 2026 prices.
            </p>
          </CardContent>
        </Card>
      ) : (
        <TransDiffManager
          groups={groups}
          oilTypes={oilTypes}
          canEdit={canEdit}
          showCost={showCost}
        />
      )}

      <div className="text-xs text-muted-foreground print:hidden">
        <Link href="/pricing" className="underline">← Back to pricing</Link>
      </div>
    </div>
  );
}
