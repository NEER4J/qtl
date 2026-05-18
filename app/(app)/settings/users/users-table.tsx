"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Eye, EyeOff, Lock, Pencil, Plus, Trash2 } from "lucide-react";
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
  toggleUserActive,
  type UserListRow,
} from "@/lib/actions/users";
import type { Location, UserRole } from "@/lib/db/types";

import { InviteUserDialog } from "./invite-user-dialog";
import { EditUserDialog } from "./edit-user-dialog";
import { SetPasswordDialog } from "./set-password-dialog";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  accountant: "Accountant",
  staff: "Staff",
  employee: "Employee",
  portal_customer: "Portal Customer",
};

type StoredPassword = { password: string; setAt: string };

export function UsersTable({
  users,
  locations,
  passwords,
}: {
  users: UserListRow[];
  locations: Location[];
  passwords: Record<string, StoredPassword>;
}) {
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<UserListRow | null>(null);
  const [deleting, setDeleting] = useState<UserListRow | null>(null);
  const [settingPassword, setSettingPassword] = useState<UserListRow | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const revealAll = () => {
    if (revealed.size === users.length) setRevealed(new Set());
    else setRevealed(new Set(Object.keys(passwords)));
  };

  const copyPassword = (id: string, pw: string) => {
    navigator.clipboard.writeText(pw).then(
      () => {
        setCopied(id);
        toast.success("Password copied");
        setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
      },
      () => toast.error("Copy failed"),
    );
  };

  const fmtSetAt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

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

  const anyStored = Object.keys(passwords).length > 0;
  const allRevealed = anyStored && revealed.size >= Object.keys(passwords).length;

  return (
    <>
      <div className="flex justify-end gap-2">
        {anyStored && (
          <Button variant="outline" onClick={revealAll}>
            {allRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {allRevealed ? "Hide all passwords" : "Show all passwords"}
          </Button>
        )}
        <Button onClick={() => setInviting(true)}>
          <Plus className="size-4" /> Add user
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-20">Expenses</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-56">Password</TableHead>
              <TableHead className="w-48 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8 px-6">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Just you for now.</p>
                    <p className="text-sm">
                      Click <strong>Add user</strong> to add your team. You&apos;ll set their password directly. Make sure you&apos;ve added your shop locations first — managers, staff, and employees all need a shop assigned.
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
                  <TableCell>
                    {passwords[u.id] ? (
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono min-w-[120px]">
                          {revealed.has(u.id) ? passwords[u.id].password : "••••••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title={revealed.has(u.id) ? "Hide" : "Show"}
                          onClick={() => toggleReveal(u.id)}
                        >
                          {revealed.has(u.id) ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Copy password"
                          onClick={() => copyPassword(u.id, passwords[u.id].password)}
                        >
                          {copied === u.id ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                        <span
                          className="text-[10px] text-muted-foreground"
                          title={`Set on ${new Date(passwords[u.id].setAt).toLocaleString()}`}
                        >
                          {fmtSetAt(passwords[u.id].setAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        not set via dashboard
                      </span>
                    )}
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
                        title="Set password"
                        onClick={() => setSettingPassword(u)}
                      >
                        <Lock className="size-4" />
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
      <SetPasswordDialog
        open={settingPassword !== null}
        onOpenChange={(open) => !open && setSettingPassword(null)}
        user={settingPassword ?? undefined}
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
