"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteIpRule,
  setIpLockEnabled,
  toggleIpRuleActive,
} from "@/lib/actions/ip-access";
import { cidrContains, describeCidrScope, formatCidr } from "@/lib/security/cidr";
import type { IpAllowlistEntryWithLocation, Location } from "@/lib/db/types";

import { IpRuleFormDialog } from "./ip-rule-form-dialog";

export function IpAccessManager({
  enabled,
  rules,
  locations,
  currentIp,
}: {
  enabled: boolean;
  rules: IpAllowlistEntryWithLocation[];
  locations: Location[];
  currentIp: string | null;
}) {
  const [editing, setEditing] = useState<IpAllowlistEntryWithLocation | null>(null);
  const [creating, setCreating] = useState(false);
  const [prefillNetwork, setPrefillNetwork] = useState<string | undefined>();
  const [deleting, setDeleting] = useState<IpAllowlistEntryWithLocation | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCount = rules.filter((r) => r.active).length;
  const currentIpCovered = useMemo(
    () =>
      !!currentIp &&
      rules.some((r) => r.active && cidrContains(r.network, currentIp)),
    [rules, currentIp],
  );

  const handleToggleLock = () => {
    startTransition(async () => {
      const res = await setIpLockEnabled({ enabled: !enabled });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.enabled
          ? "IP lock is on — only listed networks can sign in."
          : "IP lock is off — the platform is reachable from anywhere.",
      );
    });
  };

  const handleToggleRule = (rule: IpAllowlistEntryWithLocation) => {
    startTransition(async () => {
      const res = await toggleIpRuleActive({ id: rule.id, active: !rule.active });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.active ? "Address enabled" : "Address disabled");
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const res = await deleteIpRule({ id: target.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Removed ${target.label}`);
      setDeleting(null);
    });
  };

  const openCreate = (network?: string) => {
    setPrefillNetwork(network);
    setCreating(true);
  };

  return (
    <>
      {/* Master switch ------------------------------------------------------ */}
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
          <div className="flex gap-3">
            <div
              className={
                enabled
                  ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10"
                  : "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"
              }
            >
              {enabled ? (
                <ShieldCheck className="size-5 text-emerald-600" />
              ) : (
                <ShieldAlert className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">IP lock</p>
                <Badge variant={enabled ? "default" : "secondary"}>
                  {enabled ? "On" : "Off"}
                </Badge>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">
                {enabled
                  ? `Only the ${activeCount} enabled ${activeCount === 1 ? "address" : "addresses"} below can use the platform. Admins are exempt and work from anywhere.`
                  : "Anyone with a valid password can sign in from any network. Add the shop addresses below, then turn this on."}
              </p>
            </div>
          </div>
          <Button
            variant={enabled ? "outline" : "default"}
            disabled={isPending || (!enabled && activeCount === 0)}
            onClick={handleToggleLock}
          >
            {enabled ? "Turn off" : "Turn on"}
          </Button>
        </CardContent>
      </Card>

      {/* Current address ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="text-sm">
          <span className="text-muted-foreground">You are connecting from </span>
          <span className="font-mono">{currentIp ?? "an unknown address"}</span>
          {currentIp && currentIpCovered ? (
            <Badge variant="secondary" className="ml-2">
              Already allowed
            </Badge>
          ) : null}
        </div>
        {currentIp && !currentIpCovered ? (
          <Button size="sm" variant="outline" onClick={() => openCreate(currentIp)}>
            <Plus className="size-4" /> Add this address
          </Button>
        ) : null}
      </div>

      {enabled && currentIp && !currentIpCovered ? (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          Heads up: your own address isn&apos;t on the list. You can still work
          here because Admins bypass the lock — but anyone else on this network
          is being turned away.
        </p>
      ) : null}

      {/* Allowlist ---------------------------------------------------------- */}
      <div className="flex justify-end">
        <Button onClick={() => openCreate()}>
          <Plus className="size-4" /> Add address
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address / range</TableHead>
              <TableHead>Covers</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">No approved addresses yet.</p>
                    <p className="text-sm">
                      Add the address of each shop before turning the lock on.
                      The quickest start is <strong>Add this address</strong>{" "}
                      above, from a computer at the shop.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => {
                const isHere = !!currentIp && cidrContains(rule.network, currentIp);
                return (
                  <TableRow key={rule.id} className={!rule.active ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">
                      {rule.label}
                      {isHere ? (
                        <Badge variant="secondary" className="ml-2">
                          You
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono">{formatCidr(rule.network)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {describeCidrScope(rule.network)}
                    </TableCell>
                    <TableCell>{rule.location?.name ?? "All"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {rule.note ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.active ? "default" : "secondary"}>
                        {rule.active ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(rule)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleToggleRule(rule)}
                        >
                          {rule.active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(rule)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <IpRuleFormDialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) setPrefillNetwork(undefined);
        }}
        mode="create"
        locations={locations}
        defaultNetwork={prefillNetwork}
      />
      <IpRuleFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        locations={locations}
        rule={editing ?? undefined}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? formatCidr(deleting.network) : ""} will no longer be
              able to reach the platform while the lock is on. If you only want
              to pause it, use Disable instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
