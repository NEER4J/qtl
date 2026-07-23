"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
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
import { deleteEngineType, toggleEngineTypeActive } from "@/lib/actions/pricing";
import type { EngineType } from "@/lib/db/types";

import { EngineTypeFormDialog } from "./engine-type-form-dialog";

// Filter-variant rows (e.g. "4.6L V8" and "4.6L V8 With Bosch Filter") are
// separate engine_types rows on purpose — each is wired to its own
// engine_filters part/brand and priced independently (see getOilDetail). We
// must NOT merge or hide that data (tried once, reverted — see migrations
// 0110/0111). This only GROUPS them for display: one row per base engine
// number by default, with the variants a click away, so admins aren't
// staring at near-duplicate rows for the same physical engine.
function baseModelName(model: string): string {
  return model.replace(/\s+with\s+.*filter\s*$/i, "").trim();
}

function groupEngineTypes(engineTypes: EngineType[]) {
  const groups = new Map<string, EngineType[]>();
  for (const e of engineTypes) {
    const key = `${e.manufacturer}|${baseModelName(e.model).toLowerCase()}`;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }
  return [...groups.values()];
}

export function EngineTypesTable({ engineTypes }: { engineTypes: EngineType[] }) {
  const [editing, setEditing] = useState<EngineType | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const groups = useMemo(() => groupEngineTypes(engineTypes), [engineTypes]);

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggle = (e: EngineType) => {
    setPendingId(e.id);
    startTransition(async () => {
      const res = await toggleEngineTypeActive({ id: e.id, active: !e.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Engine activated" : "Engine deactivated");
    });
  };

  const handleDelete = (e: EngineType) => {
    if (
      !window.confirm(
        `Delete ${e.manufacturer} ${e.model}? This can't be undone. Any filters wired to it are removed too.`,
      )
    ) {
      return;
    }
    setPendingId(e.id);
    startTransition(async () => {
      const res = await deleteEngineType({ id: e.id });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success("Engine type deleted");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New engine type
        </Button>
      </div>

      <div className="rounded-md border max-h-[calc(100vh-220px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="w-40 text-right">Oil capacity (L)</TableHead>
              <TableHead className="w-20">Sort</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-56 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engineTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No engine types yet. Click <strong>New engine type</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((variants) => {
                const key = `${variants[0]!.manufacturer}|${baseModelName(variants[0]!.model).toLowerCase()}`;
                const hasVariants = variants.length > 1;
                const isOpen = expanded.has(key);
                // Prefer an active row to represent the group; falls back to the first.
                const primary = variants.find((v) => v.active) ?? variants[0]!;
                return (
                  <GroupRows
                    key={key}
                    primary={primary}
                    variants={variants}
                    hasVariants={hasVariants}
                    isOpen={isOpen}
                    onToggle={() => toggleExpanded(key)}
                    pendingId={pendingId}
                    onEdit={setEditing}
                    onToggleActive={handleToggle}
                    onDelete={handleDelete}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <EngineTypeFormDialog open={creating} onOpenChange={setCreating} mode="create" />
      <EngineTypeFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        engineType={editing ?? undefined}
      />
    </>
  );
}

function GroupRows({
  primary,
  variants,
  hasVariants,
  isOpen,
  onToggle,
  pendingId,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  primary: EngineType;
  variants: EngineType[];
  hasVariants: boolean;
  isOpen: boolean;
  onToggle: () => void;
  pendingId: string | null;
  onEdit: (e: EngineType) => void;
  onToggleActive: (e: EngineType) => void;
  onDelete: (e: EngineType) => void;
}) {
  return (
    <>
      <EngineRow
        engine={primary}
        displayModel={baseModelName(primary.model)}
        pendingId={pendingId}
        onEdit={onEdit}
        onToggleActive={onToggleActive}
        onDelete={onDelete}
        leading={
          hasVariants ? (
            <button
              type="button"
              onClick={onToggle}
              className="mr-1.5 inline-flex align-middle text-muted-foreground hover:text-foreground"
              title={isOpen ? "Hide filter variants" : "Show filter variants"}
            >
              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : null
        }
        trailingBadge={
          hasVariants ? (
            <Badge
              variant="outline"
              className="ml-2 cursor-pointer text-xs"
              onClick={onToggle}
            >
              {variants.length} filter variants
            </Badge>
          ) : null
        }
      />
      {hasVariants &&
        isOpen &&
        variants.map((v) => (
          <EngineRow
            key={v.id}
            engine={v}
            displayModel={v.model}
            pendingId={pendingId}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            onDelete={onDelete}
            indented
          />
        ))}
    </>
  );
}

function EngineRow({
  engine: e,
  displayModel,
  pendingId,
  onEdit,
  onToggleActive,
  onDelete,
  leading,
  trailingBadge,
  indented,
}: {
  engine: EngineType;
  displayModel: string;
  pendingId: string | null;
  onEdit: (e: EngineType) => void;
  onToggleActive: (e: EngineType) => void;
  onDelete: (e: EngineType) => void;
  leading?: ReactNode;
  trailingBadge?: ReactNode;
  indented?: boolean;
}) {
  return (
    <TableRow className={!e.active ? "opacity-60" : undefined}>
      <TableCell className="font-medium">{e.manufacturer}</TableCell>
      <TableCell className={indented ? "pl-8 text-muted-foreground" : undefined}>
        {leading}
        {displayModel}
        {trailingBadge}
      </TableCell>
      <TableCell className="text-right tabular-nums">{Number(e.oil_capacity_litres).toFixed(2)}</TableCell>
      <TableCell>{e.sort_order}</TableCell>
      <TableCell>
        <Badge variant={e.active ? "default" : "secondary"}>
          {e.active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild title="Open engine detail">
            <Link href={`/settings/pricing/engine-types/${e.id}`}>
              <ExternalLink className="size-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(e)} title="Edit">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pendingId === e.id}
            onClick={() => onToggleActive(e)}
          >
            {e.active ? "Deactivate" : "Activate"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={pendingId === e.id}
            onClick={() => onDelete(e)}
            title="Delete"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
