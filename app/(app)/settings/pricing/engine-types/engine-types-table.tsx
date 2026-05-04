"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ExternalLink, Pencil, Plus } from "lucide-react";
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
import { toggleEngineTypeActive } from "@/lib/actions/pricing";
import type { EngineType } from "@/lib/db/types";

import { EngineTypeFormDialog } from "./engine-type-form-dialog";

export function EngineTypesTable({ engineTypes }: { engineTypes: EngineType[] }) {
  const [editing, setEditing] = useState<EngineType | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (e: EngineType) => {
    setPendingId(e.id);
    startTransition(async () => {
      const res = await toggleEngineTypeActive({ id: e.id, active: !e.active });
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Engine activated" : "Engine deactivated");
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
              <TableHead className="w-48 text-right">Actions</TableHead>
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
              engineTypes.map((e) => (
                <TableRow key={e.id} className={!e.active ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{e.manufacturer}</TableCell>
                  <TableCell>{e.model}</TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => setEditing(e)} title="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === e.id}
                        onClick={() => handleToggle(e)}
                      >
                        {e.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
