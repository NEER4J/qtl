import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  ClipboardList,
  LineChart,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

interface Topic {
  title: string;
  href: string;
  summary: string;
  roles?: string[];
}

interface Section {
  title: string;
  icon: typeof BookOpen;
  topics: Topic[];
}

const SECTIONS: Section[] = [
  {
    title: "Overview",
    icon: BookOpen,
    topics: [
      { title: "Dashboard", href: "/dashboard", summary: "Month-to-date revenue, expenses, net, and outstanding." },
    ],
  },
  {
    title: "Operations",
    icon: ClipboardList,
    topics: [
      { title: "Sales list", href: "/sales", summary: "Daily job invoices with filters and status badges." },
      { title: "New sales job", href: "/sales/new", summary: "How to record a job, pick a customer, handle invoice numbers." },
      { title: "Sales detail", href: "/sales", summary: "Edit, record payments, download PDF invoices." },
      { title: "Expenses list", href: "/expenses", summary: "Vendor bills with categories, balances, recurring schedules." },
      { title: "New expense", href: "/expenses/new", summary: "HST handling, vendor auto-create, paid vs outstanding." },
      { title: "Payroll weeks", href: "/payroll", summary: "Weekly pay cycles, draft → approved → paid workflow." },
      { title: "Payroll week detail", href: "/payroll", summary: "Entries, management cash tracking, payment records." },
    ],
  },
  {
    title: "Directory",
    icon: Users,
    topics: [
      { title: "Customers", href: "/customers", summary: "Trucking companies, license plates, outstanding balances." },
      { title: "Customer profile", href: "/customers", summary: "Job history, statement CSV, portal access management." },
      { title: "Vendors", href: "/vendors", summary: "Suppliers, expense history, balance owing." },
      { title: "Pricing catalog", href: "/pricing", summary: "Parts, oil change grid, engine filter configuration." },
      { title: "Oil-change price grid", href: "/pricing/oil-grid", summary: "How the engine × oil × container grid is calculated." },
    ],
  },
  {
    title: "Analytics & Reports",
    icon: LineChart,
    topics: [
      { title: "Analytics hub", href: "/analytics", summary: "5 drill-down views: sales, jobs, products, expenses, payroll." },
      { title: "Sales & Revenue", href: "/analytics/sales", summary: "Revenue trends, payment modes, top customers, YoY." },
      { title: "Job Duration", href: "/analytics/jobs", summary: "Average times by service / bay / hour, duration buckets." },
      { title: "Products & Services", href: "/analytics/products", summary: "Service-type mix by count and revenue." },
      { title: "Expense analytics", href: "/analytics/expenses", summary: "Category pies, top vendors, paid vs outstanding." },
      { title: "Payroll analytics", href: "/analytics/payroll", summary: "Weekly cost, deductions, payroll-as-%-of-revenue." },
      { title: "Reports hub", href: "/reports", summary: "HST summary, P&L, outstanding invoices, statements." },
      { title: "HST Summary", href: "/reports/hst", summary: "Collected vs paid HST for CRA remittance." },
      { title: "P&L Report", href: "/reports/pnl", summary: "Sales − Expenses − Payroll = Net, by month and location." },
      { title: "Outstanding Invoices", href: "/reports/outstanding", summary: "Aged receivables bucketed by days overdue." },
    ],
  },
  {
    title: "Administration",
    icon: Settings,
    topics: [
      { title: "Users", href: "/settings/users", summary: "Roles matrix, invite/edit/delete, password reset." },
      { title: "Locations", href: "/settings/locations", summary: "Shop locations and their codes." },
      { title: "Expense Categories", href: "/settings/categories", summary: "Category + sub-category hierarchy." },
      { title: "Service Types", href: "/settings/services", summary: "Job types that appear on sales forms." },
      { title: "Recurring Expenses", href: "/settings/recurring-expenses", summary: "Templates for monthly / weekly / annual auto-generated expenses." },
      { title: "Statutory Rates", href: "/settings/statutory-rates", summary: "Federal EI / CPP rates. Update every January." },
      { title: "Audit Log", href: "/settings/audit-log", summary: "Every change across every module, with actor and role." },
    ],
  },
];

export default async function HelpHubPage() {
  await requireProfile();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help &amp; training</h1>
        <p className="text-sm text-muted-foreground">
          In-page help cards are on every page — click &quot;How this works&quot; at the top of any screen. This index links to all of them.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 text-sm space-y-3">
          <p className="font-medium">First time here? Set things up in this order:</p>
          <ol className="list-decimal pl-5 text-muted-foreground space-y-1">
            <li>Add your shop locations (Settings → Locations).</li>
            <li>Add the expense categories you use (Settings → Expense Categories).</li>
            <li>Invite your team (Settings → Users). Assign each person to a shop.</li>
            <li>Check the statutory rates for the current year (Settings → Statutory Rates) before running payroll.</li>
            <li>Start recording sales, expenses, and pay weeks.</li>
          </ol>
          <p className="font-medium pt-1">Things to know:</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>Every page has a collapsible <em>&quot;How this works&quot;</em> card at the top.</li>
            <li>What you see depends on your role. Staff see different pages than owners.</li>
            <li>Nothing is ever permanently erased except user accounts. Everything else &quot;deactivates&quot; so you keep the history.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-3">
              <section.icon className="size-4" />
              {section.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.topics.map((topic) => (
                <Link key={topic.href + topic.title} href={topic.href} className="group">
                  <Card className="transition-colors group-hover:border-primary/60 h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{topic.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{topic.summary}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
