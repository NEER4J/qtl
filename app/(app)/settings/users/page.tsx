import { PageHelp } from "@/components/help/page-help";
import { listLocations } from "@/lib/actions/locations";
import { listUserPasswords, listUsers } from "@/lib/actions/users";

import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, locations, passwords] = await Promise.all([
    listUsers(),
    listLocations(),
    listUserPasswords(),
  ]);
  // Build a profile_id → { password, set_at } map for the table.
  const passwordMap = Object.fromEntries(
    passwords.map((c) => [c.profile_id, { password: c.password_plain, setAt: c.set_at }]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Invite new users, assign roles and locations, deactivate without losing audit history.
          </p>
        </div>
      </div>
      <PageHelp id="settings-users">
        <p>Owner-only page. Manage who can sign in and what they can do.</p>
        <p><strong>Roles at a glance:</strong></p>
        <ul>
          <li><strong>Owner</strong> — sees everything, can change any setting, can delete users. At least one owner must always exist.</li>
          <li><strong>Manager</strong> — full access at one assigned shop. Can&apos;t see the other shops.</li>
          <li><strong>Accountant</strong> — can see every shop, can edit expenses and payroll. Good for a book-keeper.</li>
          <li><strong>Staff</strong> — the people working the bays. They record new sales jobs at their own shop but can&apos;t edit after saving. Expense access is off by default and has to be turned on per person.</li>
          <li><strong>Employee</strong> — self-service only. Sees their own pay stubs and profile, nothing else.</li>
          <li><strong>Portal Customer</strong> — created automatically when you give a trucking company access to see their own invoices.</li>
        </ul>
        <p><strong>What the buttons do:</strong></p>
        <ul>
          <li><strong>Add user</strong> — you choose their password and share it with them. They can change it later from their profile.</li>
          <li><strong>Edit</strong> (pencil) — change their role, shop, active status, and whether staff can enter expenses.</li>
          <li><strong>Set password</strong> (lock icon) — set or replace a user&apos;s password. The new password is stored so you can re-share it later.</li>
          <li><strong>Password column</strong> — owner-only. Shows the last password you set for each user (masked by default; click the eye to reveal, copy to clipboard with the copy icon). If a user changes their own password, this column will be out of date until you set one again.</li>
          <li><strong>Deactivate</strong> — temporarily turn off access; keep their history.</li>
          <li><strong>Delete</strong> (trash) — permanently remove the account. Past records they created stay but lose the name attribution.</li>
        </ul>
      </PageHelp>

      <UsersTable users={users} locations={locations} passwords={passwordMap} />
    </div>
  );
}
