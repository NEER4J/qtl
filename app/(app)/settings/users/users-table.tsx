"use client";

import { useState, useTransition } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  resetUserPassword,
  toggleUserActive,
  type UserListRow,
} from "@/lib/actions/users";
import type { Location, UserRole } from "@/lib/db/types";

import { InviteUserDialog } from "./invite-user-dialog";
import { EditUserDialog } from "./edit-user-dialog";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  accountant: "Accountant",
  staff: "Staff",
  employee: "Employee",
};

export function UsersTable({
  users,
  locations,
}: {
  users: UserListRow[];
  locations: Location[];
}) {
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<UserListRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (u: UserListRow) => {
    startTransition(async () => {
      const result = await toggleUserActive({ id: u.id, active: !u.active });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.active ? "User reactivated" : "User deactivated");
    });
  };

  const handleResetPassword = (u: UserListRow) => {
    startTransition(async () => {
      const result = await resetUserPassword({ id: u.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reset email sent to ${u.email}`);
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setInviting(true)}>
          <Plus className="size-4" /> Invite user
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-20">Expenses</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No users yet. Invite your first team member.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} className={!u.active ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "owner" ? "default" : "secondary"}>
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.location_name ?? "—"}</TableCell>
                  <TableCell>
                    {u.role === "staff" ? (u.can_enter_expenses ? "Yes" : "No") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.active ? "default" : "secondary"}>
                      {u.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => setEditing(u)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Send password reset"
                        disabled={isPending}
                        onClick={() => handleResetPassword(u)}
                      >
                        <KeyRound className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggle(u)}
                      >
                        {u.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <InviteUserDialog
        open={inviting}
        onOpenChange={setInviting}
        locations={locations}
      />
      <EditUserDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        user={editing ?? undefined}
        locations={locations}
      />
    </>
  );
}
