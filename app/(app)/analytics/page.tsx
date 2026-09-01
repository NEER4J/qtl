import Link from "next/link";
import {
  LineChart as SalesIcon,
  Clock,
  PackageOpen,
  ShoppingCart,
  Wallet,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { requirePage } from "@/lib/auth/require";
import { isPageAllowed } from "@/lib/permissions/check";
import { pageKeyForRequestPath } from "@/lib/permissions/registry";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    title: "Sales & Revenue",
    href: "/analytics/sales",
    icon: SalesIcon,
    description: "Revenue trends, location comparisons, payment modes, top customers.",
    roles: ["owner", "co_owner", "manager", "accountant"],
  },
  {
    title: "Job Duration",
    href: "/analytics/jobs",
    icon: Clock,
    description: "How long jobs take, by service type, bay, hour of day, and day of week.",
    roles: ["owner", "co_owner", "manager", "accountant"],
  },
  {
    title: "Products & Services",
    href: "/analytics/products",
    icon: PackageOpen,
    description: "Service type performance: most performed, highest revenue, trends.",
    roles: ["owner", "co_owner", "manager", "accountant"],
  },
  {
    title: "Expenses",
    href: "/analytics/expenses",
    icon: ShoppingCart,
    description: "Spend by category and vendor, monthly trends, paid vs outstanding.",
    roles: ["owner", "co_owner", "manager", "accountant"],
  },
  {
    title: "Payroll",
    href: "/analytics/payroll",
    icon: Wallet,
    description: "Weekly payroll cost, deductions, payroll-to-revenue ratio.",
    roles: ["owner", "co_owner", "accountant"],
  },
] as const;

export default async function AnalyticsHubPage() {
  const profile = await requirePage("analytics");

  // Tiles follow the permissions matrix, not the hard-coded `roles` list: a
  // sub-page with its own registry key (Payroll) is shown when that key is
  // granted, everything else rides on the parent `analytics` grant we just
  // passed. Filtering by role here would re-hide pages the matrix allowed.
  const cards = CARDS.filter((c) => {
    const key = pageKeyForRequestPath(c.href);
    return key ? isPageAllowed(profile, key) : true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Business performance across all modules.</p>
      </div>

      <PageHelp id="analytics-hub">
        <p>Each section answers a different business question:</p>
        <ul>
          <li><strong>Sales & Revenue</strong> — where the money comes from. Revenue trends, top customers, comparisons between shops, year-over-year growth.</li>
          <li><strong>Job Duration</strong> — how efficient the shop is. How long jobs take, busiest hours, fastest bay.</li>
          <li><strong>Products & Services</strong> — your service mix. Oil change vs grease vs miscellaneous by volume and revenue.</li>
          <li><strong>Expenses</strong> — where money goes. Breakdown by category, top vendors, month-by-month.</li>
          <li><strong>Payroll</strong> — labour costs by week and shop, deductions, and payroll as a percentage of revenue.</li>
        </ul>
        <p>
          Every page has date and shop filters, and a button to download the numbers as a spreadsheet.
        </p>
      </PageHelp>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="transition-colors group-hover:border-primary/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <c.icon className="size-4 text-muted-foreground" />
                  {c.title}
                </CardTitle>
                <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{c.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
