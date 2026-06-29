import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllPromotions } from "@/lib/actions/promotions";

import { PromotionsTable } from "./promotions-table";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  await requireRole("owner", "co_owner");
  const promotions = await listAllPromotions();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
        <p className="text-sm text-muted-foreground">
          Named discounts (percent or fixed $) you can add to a sales job or an expense.
        </p>
      </div>

      <PageHelp id="settings-promotions">
        <p>
          A promotion is a reusable discount. Add it on a sales job (it becomes a negative
          discount line) or on an expense.
        </p>
        <ul>
          <li><strong>Percent</strong> takes a % off the current sub-total.</li>
          <li><strong>Fixed</strong> takes a flat dollar amount off.</li>
          <li><strong>Deactivate</strong> hides a promotion from the pickers but keeps its history.</li>
        </ul>
      </PageHelp>

      <PromotionsTable promotions={promotions} />
    </div>
  );
}
