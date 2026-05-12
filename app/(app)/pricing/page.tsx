import Link from "next/link";
import { ChevronRight, Droplet, Package, ListChecks, FileText, Gauge } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

const CARDS = [
  { title: "Filter price list", href: "/pricing/filters", icon: Package, description: "Searchable catalog of every filter QTL stocks." },
  { title: "All filter sell price", href: "/pricing/all-filter-price", icon: ListChecks, description: "Per-filter sell price in all four service modes (with / without / counter / customer-supplies)." },
  { title: "Oil-change price grid", href: "/pricing/oil-grid", icon: Droplet, description: "Every engine × every oil type, with bulk and gallon prices." },
  { title: "Oil detail (per oil)", href: "/pricing/oil-detail", icon: Gauge, description: "Per-oil breakdown: selling, cost, filter cost, oil cost, profit, margin %." },
  { title: "Print list", href: "/pricing/print-list", icon: FileText, description: "Print-ready price card for the shop floor and customer handouts." },
];

export default async function PricingHubPage() {
  await requireProfile();
  return <PricingHub />;
}

function PricingHub() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pricing catalog</h1>
        <p className="text-sm text-muted-foreground">
          Filter and oil-change pricing across all engines and service modes.
        </p>
      </div>

      <PageHelp id="pricing-hub">
        <p>
          This replaces the old pricing spreadsheet. Staff can look up what to charge a customer; the owner can update the underlying oil and filter costs and every sell price recalculates automatically.
        </p>
        <ul>
          <li><strong>Filter price list</strong> — a searchable catalogue of every filter you stock. Everyone sees the sell price; only the owner sees the cost column.</li>
          <li><strong>Oil-change price grid</strong> — 45 engines across 7 oil grades, with bulk and gallon prices side-by-side. When the owner updates an oil cost, every cell in that column updates right away.</li>
        </ul>
        <p>
          The catalogue is empty until someone loads in the filters, engines, and oil types. This is done once from the old spreadsheet during setup.
        </p>
      </PageHelp>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="transition-colors group-hover:border-primary/60 h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <c.icon className="size-4 text-muted-foreground" />
                  {c.title}
                </CardTitle>
                <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{c.description}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
