import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/help/page-help";
import { requirePage } from "@/lib/auth/require";
import {
  listAllEmployees,
  listLinkableProfiles,
} from "@/lib/actions/payroll";
import { getAppSettings, listActiveLocations } from "@/lib/actions/reference";

import { EmployeesTable } from "./employees-table";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requirePage("payroll_employees");
  const [rows, locations, profiles, settings] = await Promise.all([
    listAllEmployees(),
    listActiveLocations(),
    listLinkableProfiles(),
    getAppSettings(),
  ]);
  const shopVacationRate = Number(settings.vacation_pay_rate ?? 0.04);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            The staff records that feed the employee picker on a payroll entry.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/payroll">
            <ChevronLeft className="size-4" /> Back to payroll
          </Link>
        </Button>
      </div>

      <PageHelp id="payroll-employees">
        <p>
          Add everyone you pay here <strong>before</strong> creating a pay week — the employee
          dropdown on a payroll entry is filled from this list.
        </p>
        <ul>
          <li><strong>Type</strong> — Employee uses the standard fields; Management can also take a cheque portion + daily cash.</li>
          <li><strong>Default hourly rate</strong> and the <strong>Pay defaults</strong> (hours, overtime hours, bonus, phone allowance, misc extra, income tax, benefits) fill in a new payroll entry as soon as you pick this person — no retyping every week. Overtime starts at 1.5× the hourly rate. Anything can still be changed on the entry for a single week; leave a default blank for none.</li>
          <li><strong>Vacation % override</strong> — this person&apos;s own vacation pay rate (e.g. 6% after five years). Blank uses the shop rate ({Math.round(shopVacationRate * 10000) / 100}%) from the Payroll page.</li>
          <li><strong>Deductions that apply</strong> — EI, CPP, CPP2, income tax, vacation and WSIB switches that a new entry starts from.</li>
          <li><strong>Linked login user</strong> connects this employee to a sign-in account so that person can see their own pay on the <Link href="/my-pay" className="underline">My Pay</Link> page. Leave it unlinked for staff who don&apos;t log in.</li>
          <li><strong>Deactivate</strong> hides someone from new payroll entries but keeps their history intact.</li>
        </ul>
      </PageHelp>

      <EmployeesTable
        rows={rows}
        locations={locations}
        profiles={profiles}
        shopVacationRate={shopVacationRate}
      />
    </div>
  );
}
