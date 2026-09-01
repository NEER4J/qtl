"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Eye, EyeOff, Lock, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applyDefaultPermissions,
  bulkUserAction,
  deleteUser,
  toggleUserActive,
  type UserListRow,
} from "@/lib/actions/users";
import type { Location, UserRole, Profile } from "@/lib/db/types";
import { visibleColumnKeys } from "@/lib/permissions/check";
import { isSyntheticEmail } from "@/lib/schemas/users";
import { locationMode } from "@/lib/auth/locations";

import { InviteUserDialog } from "./invite-user-dialog";
import { EditUserDialog } from "./edit-user-dialog";
import { SetPasswordDialog } from "./set-password-dialog";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  co_owner: "Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  accountant: "Accountant",
  staff: "Staff",
  technician: "Technician",
  employee: "Employee",
  portal_customer: "Portal Customer",
};

type StoredPassword = { password: string; setAt: string };

const ALL_COLUMNS = [
  // Note: "email" used to be a separate column. It's been folded into the
  // single "Login" column (real email shown as a secondary line beneath the
  // @username for username users; shown as the primary for owner/accountant).
  // The registry entry was dropped at the same time, so any previously-saved
  // "email" hide override is now a no-op rather than orphaning silently.
  "role",
  "location",
  "expenses",
  "status",
  "password",
  "last_login",
] as const;

export function UsersTable({
  users,
  locations,
  passwords,
  viewer,
  canManage,
}: {
  users: UserListRow[];
  locations: Location[];
  passwords: Record<string, StoredPassword>;
  viewer: Pick<Profile, "id" | "role" | "allowed_pages" | "hidden_columns">;
  /**
   * Whether the viewer can actually WRITE here. Page access is granted by the
   * permissions matrix, but every user mutation stays owner/co_owner-only in
   * the server action AND in the profiles_guard DB trigger — so someone who
   * was granted this page without being an admin gets a read-only view rather
   * than buttons that fail on click.
   */
  canManage: boolean;
}) {
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<UserListRow | null>(null);
  const [deleting, setDeleting] = useState<UserListRow | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<
    null | "deactivate" | "reactivate" | "delete" | "reset_permissions"
  >(null);
  const [settingPassword, setSettingPassword] = useState<UserListRow | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visibleKeys = useMemo(
    () => visibleColumnKeys(viewer, "settings_users", ALL_COLUMNS),
    [viewer],
  );
  const visible = (key: (typeof ALL_COLUMNS)[number]) => visibleKeys.includes(key);

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
      toast.success(`${target.full_name || target.username || target.email} deleted`);
      setDeleting(null);
    });
  };

  const handleBulk = (action: "deactivate" | "reactivate" | "delete") => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkUserAction({ ids, action });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data.affected} user${res.data.affected === 1 ? "" : "s"} ${action}d`);
      setBulkConfirm(null);
      setSelected(new Set());
    });
  };

  const handleApplyDefaults = () => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await applyDefaultPermissions({ ids });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Role defaults applied to ${res.data.affected} user${res.data.affected === 1 ? "" : "s"}`,
      );
      setBulkConfirm(null);
      setSelected(new Set());
    });
  };

  const selectableIds = useMemo(
    () => users.filter((u) => u.id !== viewer.id).map((u) => u.id),
    [users, viewer.id],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  };
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const anyStored = Object.keys(passwords).length > 0;
  const allRevealed = anyStored && revealed.size >= Object.keys(passwords).length;
  const hasSelection = selected.size > 0;

  const otherUsers = useMemo(() => users.filter((u) => u.id !== viewer.id), [users, viewer.id]);

  // Column count for empty-state colspan: identity + checkbox + name + visibles + actions
  const colspan = 2 + visibleKeys.length + (canManage ? 2 : 0);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!canManage ? (
            <span className="text-xs text-muted-foreground">
              Read-only — only an Admin can add or change users.
            </span>
          ) : hasSelection ? (
            <>
              <Badge variant="secondary">{selected.size} selected</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkConfirm("deactivate")}
                disabled={isPending}
              >
                Deactivate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkConfirm("reactivate")}
                disabled={isPending}
              >
                Reactivate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkConfirm("reset_permissions")}
                disabled={isPending}
                title="Clear custom overrides so these users inherit their role's default permissions"
              >
                <Sparkles className="size-4" /> Apply role defaults
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700"
                onClick={() => setBulkConfirm("delete")}
                disabled={isPending}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Tip: tick rows to bulk-deactivate, reactivate, or delete.
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {visible("password") && anyStored && (
            <Button variant="outline" onClick={revealAll}>
              {allRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {allRevealed ? "Hide all passwords" : "Show all passwords"}
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setInviting(true)}>
              <Plus className="size-4" /> Add user
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-260px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {canManage && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead>Login</TableHead>
              {visible("role") && <TableHead>Role</TableHead>}
              {visible("location") && <TableHead>Location</TableHead>}
              {visible("expenses") && <TableHead className="w-20">Expenses</TableHead>}
              {visible("status") && <TableHead className="w-24">Status</TableHead>}
              {visible("password") && <TableHead className="w-56">Password</TableHead>}
              {visible("last_login") && <TableHead className="w-40">Last login</TableHead>}
              {canManage && <TableHead className="w-48 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colspan} className="text-center text-muted-foreground py-8 px-6">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Just you for now.</p>
                    <p className="text-sm">
                      Click <strong>Add user</strong> to add your team. You&apos;ll set their password directly.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.id === viewer.id;
                return (
                  <TableRow key={u.id} className={!u.active ? "opacity-60" : undefined}>
                    {canManage && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(u.id)}
                          onCheckedChange={() => toggleSelect(u.id)}
                          disabled={isSelf}
                          aria-label={`Select ${u.full_name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {u.username ? (
                        <div className="flex flex-col leading-tight">
                          <span>@{u.username}</span>
                          {/* Real email shown as a secondary line only when
                              the user has one set and it's not the synthetic
                              `@team.qtl.app` address generated for logins. */}
                          {!isSyntheticEmail(u.email) && (
                            <span className="text-[10px] text-muted-foreground">
                              {u.email}
                            </span>
                          )}
                        </div>
                      ) : (
                        u.email
                      )}
                    </TableCell>
                    {visible("role") && (
                      <TableCell>
                        <Badge variant={(u.role === "owner" || u.role === "co_owner") ? "default" : "secondary"}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                        {u.allowed_pages !== null && u.role !== "co_owner" && (
                          <Badge variant="outline" className="ml-1 text-[10px] py-0">custom</Badge>
                        )}
                      </TableCell>
                    )}
                    {visible("location") && (
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <span>{u.location_name ?? "—"}</span>
                          {locationMode(u) === "all" && (
                            <Badge
                              variant="outline"
                              className="border-emerald-300 text-[10px] text-emerald-700"
                              title="Has access to all locations"
                            >
                              All locations
                            </Badge>
                          )}
                          {locationMode(u) === "multi" && (
                            <Badge
                              variant="outline"
                              className="border-sky-300 text-[10px] text-sky-700"
                              title={`Also works at ${(u.location_ids ?? []).length - 1} other location(s)`}
                            >
                              +{Math.max((u.location_ids ?? []).length - 1, 0)} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visible("expenses") && (
                      <TableCell>
                        {u.role === "staff" ? (u.can_enter_expenses ? "Yes" : "No") : "—"}
                      </TableCell>
                    )}
                    {visible("status") && (
                      <TableCell>
                        <Badge variant={u.active ? "default" : "secondary"}>
                          {u.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    )}
                    {visible("password") && (
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
                    )}
                    {visible("last_login") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Never"}
                      </TableCell>
                    )}
                    {canManage && (
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
                          disabled={isPending || isSelf}
                          onClick={() => handleToggle(u)}
                        >
                          {u.active ? "Deactivate" : "Reactivate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete user"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          disabled={isPending || isSelf}
                          onClick={() => setDeleting(u)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <InviteUserDialog
        open={inviting}
        onOpenChange={setInviting}
        locations={locations}
        otherUsers={otherUsers}
      />
      <EditUserDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        user={editing ?? undefined}
        locations={locations}
        otherUsers={otherUsers}
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
              This permanently removes {deleting?.full_name || deleting?.username || deleting?.email} from
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

      <AlertDialog
        open={bulkConfirm !== null}
        onOpenChange={(open) => !open && setBulkConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkConfirm === "delete"
                ? `Delete ${selected.size} user${selected.size === 1 ? "" : "s"}?`
                : bulkConfirm === "deactivate"
                  ? `Deactivate ${selected.size} user${selected.size === 1 ? "" : "s"}?`
                  : bulkConfirm === "reset_permissions"
                    ? `Apply role defaults to ${selected.size} user${selected.size === 1 ? "" : "s"}?`
                    : `Reactivate ${selected.size} user${selected.size === 1 ? "" : "s"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkConfirm === "delete"
                ? "This permanently removes their logins. History rows stay but lose name attribution. Cannot be undone."
                : bulkConfirm === "deactivate"
                  ? "They will be unable to sign in until reactivated. History preserved."
                  : bulkConfirm === "reset_permissions"
                    ? "Any custom page/column overrides on these users are cleared, so each one falls back to its role's default access from the staff matrix. Their role, login, and location are unchanged."
                    : "They will be able to sign in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (bulkConfirm === "reset_permissions") handleApplyDefaults();
                else if (bulkConfirm) handleBulk(bulkConfirm);
              }}
              disabled={isPending}
              className={bulkConfirm === "delete" ? "bg-rose-600 hover:bg-rose-700" : undefined}
            >
              {isPending ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
