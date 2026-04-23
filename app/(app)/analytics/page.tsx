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
import { requireProfile } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    title: "Sales & Revenue",
    href: "/analytics/sales",
    icon: SalesIcon,
    description: "Revenue trends, location comparisons, payment modes, top customers.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    title: "Job Duration",
    href: "/analytics/jobs",
    icon: Clock,
    description: "How long jobs take, by service type, bay, hour of day, and day of week.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    title: "Products & Services",
    href: "/analytics/products",
    icon: PackageOpen,
    description: "Service type performance: most performed, highest revenue, trends.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    title: "Expenses",
    href: "/analytics/expenses",
    icon: ShoppingCart,
    description: "Spend by category and vendor, monthly trends, paid vs outstanding.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    title: "Payroll",
    href: "/analytics/payroll",
    icon: Wallet,
    description: "Weekly payroll cost, deductions, payroll-to-revenue ratio.",
    roles: ["owner", "accountant"],
  },
] as const;

export default async function AnalyticsHubPage() {
  const profile = await requireProfile();

  const cards = CARDS.filter((c) => (c.roles as readonly string[]).includes(profile.role));

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Business performance across all modules.</p>
      </div>

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
