import { getPnlReport } from "@/lib/actions/reports";
import { csvResponse, toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getPnlReport({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# P&L Report — ${data.period_label}\n`);
  sections.push(`Sales,${data.sales_total.toFixed(2)}`);
  sections.push(`Expenses,${data.expense_total.toFixed(2)}`);
  sections.push(`Payroll,${data.payroll_total.toFixed(2)}`);
  sections.push(`Net profit,${data.net_profit.toFixed(2)}\n`);

  sections.push(`## By month`);
  sections.push(toCsv(data.by_month as unknown as Record<string, unknown>[], ["month", "sales", "expenses", "payroll", "net"]));
  sections.push("");

  sections.push(`## By location`);
  sections.push(toCsv(data.by_location as unknown as Record<string, unknown>[], ["name", "sales", "expenses", "payroll", "net"]));

  return csvResponse(`pnl-${new Date().toISOString().slice(0, 10)}.csv`, sections.join("\n"));
}
