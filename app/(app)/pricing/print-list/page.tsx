import { Card, CardContent } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { PrintButton } from "@/components/pricing/print-button";
import { requireProfile } from "@/lib/auth/require";
import { getPrintList } from "@/lib/actions/pricing";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PrintListPage() {
  await requireProfile();
  const { columns, rows, effective_date, company_name } = await getPrintList();

  // Split columns visually: priced columns (gallon + synthetic bulk) and
  // the three reference bulk columns that close out the table.
  const priced = columns.filter((c) => !c.is_reference);
  const reference = columns.filter((c) => c.is_reference);

  return (
    <div className="flex flex-col gap-6">
      {/* Force landscape orientation when printing — the table is wide. */}
      <style>{"@media print { @page { size: landscape; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Print list</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} engine{rows.length === 1 ? "" : "s"} · {columns.length} price column{columns.length === 1 ? "" : "s"} · {priced.length} priced + {reference.length} reference
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="print:hidden">
        <PageHelp id="pricing-print-list">
          <p>
            Click <strong>Print</strong> (top right) to print a clean copy or save as PDF — the page
            header, sidebar, and help blocks are hidden in print.
          </p>
          <ul>
            <li>Every price ends in .99 and is the active sell price (manual override if set, otherwise cost-up).</li>
            <li><strong>Gallon</strong> column is shown for every oil. <strong>Bulk</strong> column is shown for synthetic oils (T6, Delo 5W30, Petro 5W30).</li>
            <li>The three reference bulk columns at the end (15W40, 10W30, Delo 5W30) let staff quickly compare against the base 15W40 price.</li>
            <li>Update the effective date and prices from{" "}
              <a href="/settings/pricing" className="underline">Pricing catalogue admin</a>.</li>
          </ul>
        </PageHelp>
      </div>

      {/* Print header — only visible in print */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">{company_name}</h1>
        <p className="text-sm">Oil change price list</p>
        {effective_date && <p className="text-xs">Effective: {formatDate(effective_date)}</p>}
      </div>

      {/* Screen header */}
      <div className="print:hidden flex items-baseline gap-4">
        <span className="text-sm font-medium">{company_name}</span>
        {effective_date && (
          <span className="text-xs text-muted-foreground">Effective {formatDate(effective_date)}</span>
        )}
      </div>

      {rows.length === 0 || columns.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-sm text-muted-foreground text-center">
            No engines or oil types configured yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-0 overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm border-collapse print:text-[10px]">
              <thead className="bg-muted/50 print:bg-transparent">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/50 print:bg-transparent print:border print:border-foreground/40">
                    Engine
                  </th>
                  <th className="text-right p-2 text-xs text-muted-foreground print:border print:border-foreground/40">
                    Capacity
                  </th>
                  {columns.map((c, i) => {
                    const firstReference = c.is_reference && (i === 0 || !columns[i - 1].is_reference);
                    return (
                      <th
                        key={c.key}
                        className={`p-2 text-right min-w-[90px] print:border print:border-foreground/40 ${firstReference ? "border-l-4 border-l-muted-foreground/40" : "border-l"} ${c.is_reference ? "bg-muted/30" : c.container === "bulk" ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                      >
                        <div className="font-medium">{c.label}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{c.sublabel}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.engine_id} className="border-t">
                    <td className="p-2 font-medium sticky left-0 bg-background print:bg-transparent print:border print:border-foreground/40 whitespace-nowrap">
                      {r.engine_name}
                    </td>
                    <td className="p-2 text-right tabular-nums text-xs text-muted-foreground print:border print:border-foreground/40">
                      {r.oil_capacity_litres.toFixed(1)}L
                    </td>
                    {columns.map((c, i) => {
                      const firstReference = c.is_reference && (i === 0 || !columns[i - 1].is_reference);
                      const price = r.prices[i];
                      return (
                        <td
                          key={c.key}
                          className={`p-2 text-right tabular-nums print:border print:border-foreground/40 ${firstReference ? "border-l-4 border-l-muted-foreground/40" : "border-l"} ${c.is_reference ? "bg-muted/10" : c.container === "bulk" ? "bg-blue-50/20 dark:bg-blue-950/10" : ""}`}
                        >
                          {price != null ? formatMoney(price) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
