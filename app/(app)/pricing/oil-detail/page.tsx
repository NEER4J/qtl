import { redirect } from "next/navigation";

import { listOilTypes } from "@/lib/actions/pricing";

export const dynamic = "force-dynamic";

/**
 * Land on /pricing/oil-detail with no oil chosen — redirect to the base oil
 * type (15W40) or the first active one.
 */
export default async function OilDetailIndexPage() {
  const oilTypes = await listOilTypes();
  if (oilTypes.length === 0) redirect("/pricing");
  const base = oilTypes.find((o) => o.is_base) ?? oilTypes[0];
  redirect(`/pricing/oil-detail/${encodeURIComponent(base.code)}`);
}
