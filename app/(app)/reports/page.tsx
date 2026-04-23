import Link from "next/link";
import {
  FileText,
  ReceiptText,
  ScrollText,
  TrendingUp,
  ChevronRight,
  Percent,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

const REPORTS = [
  {
    title: "HST Summary",
    href: "/reports/hst",
    icon: Percent,
    description: "HST collected vs paid for tax filing.",
    roles: ["owner", "accountant"],
  },
  {
    title: "P&L Report",
    href: "/reports/pnl",
    icon: TrendingUp,
    description: "Sales − Expenses − Payroll = Net, per location & month.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    title: "Outstanding Invoices",
    href: "/reports/outstanding",
    icon: ReceiptText,
    description: "Aged receivables (1-30, 31-60, 61-90, 90+ days).",
    roles: ["owner", "manager", "accountant"],
  },
  {
    title: "Customer Statement",
    href: "/customers",
    icon: ScrollText,
    description: "Select a customer from the directory to view or export.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    title: "Vendor Statement",
    href: "/vendors",
    icon: FileText,
    description: "Select a vendor from the directory to view or export.",
    roles: ["owner", "manager", "accountant"],
  },
] as const;

export default async function ReportsHubPage() {
  const profile = await requireProfile();
  const reports = REPORTS.filter((r) => (r.roles as readonly string[]).includes(profile.role));

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Formatted reports with PDF and CSV exports.</p>
      </div>

      <PageHelp id="reports-hub">
        <p>Formatted reports you can export for business, accounting, and tax purposes.</p>
        <ul>
          <li><strong>HST Summary</strong> — what you collected versus what you paid. For filing your HST return with CRA.</li>
          <li><strong>P&amp;L Report</strong> — the full profit-and-loss view. Includes payroll, unlike the dashboard snapshot.</li>
          <li><strong>Outstanding Invoices</strong> — unpaid invoices grouped by how overdue they are. For following up with customers.</li>
          <li><strong>Customer or Vendor Statement</strong> — a per-customer or per-vendor transaction history. Open any customer or vendor profile and click the statement button.</li>
        </ul>
        <p>Every report has a spreadsheet-download button.</p>
      </PageHelp>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="transition-colors group-hover:border-primary/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <r.icon className="size-4 text-muted-foreground" />
                  {r.title}
                </CardTitle>
                <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
