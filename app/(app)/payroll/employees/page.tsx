import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import {
  listAllEmployees,
  listLinkableProfiles,
} from "@/lib/actions/payroll";
import { listActiveLocations } from "@/lib/actions/reference";

import { EmployeesTable } from "./employees-table";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requireRole("owner", "co_owner", "manager", "accountant");
  const [rows, locations, profiles] = await Promise.all([
    listAllEmployees(),
    listActiveLocations(),
    listLinkableProfiles(),
  ]);

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
          <li><strong>Default hourly rate</strong> pre-fills the rate on a new payroll entry (you can still override it per week).</li>
          <li><strong>Linked login user</strong> connects this employee to a sign-in account so that person can see their own pay on the <Link href="/my-pay" className="underline">My Pay</Link> page. Leave it unlinked for staff who don&apos;t log in.</li>
          <li><strong>Deactivate</strong> hides someone from new payroll entries but keeps their history intact.</li>
        </ul>
      </PageHelp>

      <EmployeesTable rows={rows} locations={locations} profiles={profiles} />
    </div>
  );
}
