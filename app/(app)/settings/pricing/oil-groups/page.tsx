import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllOilGroups, listAllOilTypes } from "@/lib/actions/pricing";

import { OilGroupsTable } from "./oil-groups-table";

export const dynamic = "force-dynamic";

export default async function OilGroupsPage() {
  await requireRole("owner", "co_owner");
  const [groups, oilTypes] = await Promise.all([listAllOilGroups(), listAllOilTypes()]);

  // listAllOilGroups returns [] both when the table is missing and when nobody
  // has made a group yet; the column tells the two apart.
  const migrationApplied = oilTypes.some((o) => "oil_group_id" in o);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Oil groups</h1>
        <p className="text-sm text-muted-foreground">
          A base price shared by several grades. Every oil in a group is charged the group&apos;s
          rate on a sales job.
        </p>
      </div>

      {!migrationApplied && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Oil groups need <span className="font-mono text-xs">migration 0133</span>. Until it is
          applied, every grade keeps being charged at the single base grade&apos;s rate and
          nothing on this page takes effect.
        </div>
      )}

      <PageHelp id="settings-pricing-oil-groups">
        <p>
          An oil line on a sales job has never been charged at the oil&apos;s own cost — it is
          charged at a <strong>base price</strong>. There used to be exactly one base grade for
          every oil, so a full-synthetic 5W30 was offered at the 15W40 rate. A group is a base
          price with a name, so each family of grades gets its own.
        </p>
        <ul>
          <li>
            <strong>Bulk $/L</strong> is charged per litre. <strong>Gallon $/container</strong>{" "}
            is the price of a whole container, not a litre.
          </li>
          <li>
            Leave a price <strong>empty</strong> to fall back to the old single base-grade rate
            for that container. <strong>0</strong> is a real $0 price, not a fallback.
          </li>
          <li>
            A grade joins a group on the <strong>Oil types</strong> page. A grade in no group is
            charged at the base grade, exactly as before.
          </li>
          <li>
            The price still lands on the line as an editable number — this sets what the line
            starts at, it does not lock it.
          </li>
          <li>
            Groups do <em>not</em> change engine oil-change pricing, packages, or the price grid.
            Those already use each oil&apos;s own cost and are untouched.
          </li>
        </ul>
      </PageHelp>

      <OilGroupsTable groups={groups} oilTypes={oilTypes} />
    </div>
  );
}
