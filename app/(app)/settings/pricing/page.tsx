import Link from "next/link";
import { Boxes, ChevronRight, Droplet, FolderTree, Gauge, History, Layers, Package, Tag, Wrench } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { MinMarginThresholdCard } from "@/components/settings/min-margin-threshold-card";
import { requireRole } from "@/lib/auth/require";
import { getAppSettings } from "@/lib/actions/reference";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    title: "Oil types",
    href: "/settings/pricing/oil-types",
    icon: Droplet,
    description: "Grades QTL sells (15W40, T5, T6, etc.) with bulk and gallon cost per litre.",
  },
  {
    title: "Engine types",
    href: "/settings/pricing/engine-types",
    icon: Gauge,
    description: "Engine configurations and the filter sets installed on each.",
  },
  {
    title: "Parts catalogue",
    href: "/settings/pricing/parts",
    icon: Package,
    description: "The filter catalogue — part number, brand, cost, list price, MHSW fee.",
  },
  {
    title: "Packages",
    href: "/settings/pricing/packages",
    icon: Boxes,
    description: "Pre-defined bundles of parts you can drop onto a sales job in one click.",
  },
  {
    title: "Part categories",
    href: "/settings/pricing/categories",
    icon: FolderTree,
    description: "Reference list behind the Category dropdown. Rename cascades to every part.",
  },
  {
    title: "Part brands",
    href: "/settings/pricing/brands",
    icon: Tag,
    description: "Reference list behind the Brand dropdown. Rename cascades to every part.",
  },
  {
    title: "Service (labour) costs",
    href: "/settings/pricing/service-costs",
    icon: Wrench,
    description: "Labour cost per filter type. Feeds the oil-change price calculation.",
  },
  {
    title: "Volume tiers",
    href: "/settings/pricing/volume-tiers",
    icon: Layers,
    description: "Flat premiums applied to oil-changes based on engine oil capacity.",
  },
  {
    title: "Price history",
    href: "/settings/pricing/price-history",
    icon: History,
    description: "Audit log of every cost / list-price / labour change.",
  },
];

export default async function PricingAdminHubPage() {
  await requireRole("owner");
  const settings = await getAppSettings();
  const initialPct = Math.round(Number(settings.min_margin_alert_pct) * 1000) / 10;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pricing catalogue</h1>
        <p className="text-sm text-muted-foreground">
          Manage the data that drives the filter price list and the oil-change price grid.
        </p>
      </div>

      <PageHelp id="settings-pricing-hub">
        <p>
          Everything on the staff-facing <strong>Pricing</strong> pages is computed from the tables below.
          When you change an oil cost, filter cost, labour cost, volume-tier premium, engine capacity, or
          the filters assigned to an engine, the oil-change grid recalculates on the next page load.
        </p>
        <ul>
          <li><strong>Oil types</strong> — the grades you sell. Two cost columns: bulk (litre) and gallon.</li>
          <li><strong>Engine types</strong> — each engine has an oil capacity and a set of filters (edit both on the engine&apos;s detail page).</li>
          <li><strong>Parts</strong> — the filter catalogue. Each part can link to a labour cost.</li>
          <li><strong>Service costs</strong> — labour for installing each kind of filter.</li>
          <li><strong>Volume tiers</strong> — flat premium per oil type based on engine oil capacity brackets.</li>
        </ul>
        <p>
          Initial seeding (the 800 parts and 45 engines from the old spreadsheet) is done by the developer
          via <code>npm run migrate</code>. Use these pages for ongoing additions and edits.
        </p>
      </PageHelp>

      <MinMarginThresholdCard initialPct={initialPct} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
