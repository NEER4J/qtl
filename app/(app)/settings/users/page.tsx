import { listLocations } from "@/lib/actions/locations";
import { listUsers } from "@/lib/actions/users";

import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, locations] = await Promise.all([listUsers(), listLocations()]);

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
      <UsersTable users={users} locations={locations} />
    </div>
  );
}
