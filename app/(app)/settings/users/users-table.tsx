"use client";

import { useState, useTransition } from "react";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  deleteUser,
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
  portal_customer: "Portal Customer",
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
  const [deleting, setDeleting] = useState<UserListRow | null>(null);
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

  const handleDelete = () => {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteUser({ id: target.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${target.full_name || target.email} deleted`);
      setDeleting(null);
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8 px-6">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Just you for now.</p>
                    <p className="text-sm">
                      Click <strong>Invite user</strong> to add your team. Each person gets an email with a link to set their own password. Make sure you&apos;ve added your shop locations first — managers, staff, and employees all need a shop assigned.
                    </p>
                  </div>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete user"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        disabled={isPending}
                        onClick={() => setDeleting(u)}
                      >
                        <Trash2 className="size-4" />
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
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleting?.full_name || deleting?.email} from
              the system, including their login. Their past sales, expenses, and
              audit entries stay — those rows reference deleted auth IDs but
              don&apos;t get removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isPending ? "Deleting…" : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
