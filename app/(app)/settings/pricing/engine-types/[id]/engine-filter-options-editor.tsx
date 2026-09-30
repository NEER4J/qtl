"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addEngineFilterOption,
  removeEngineFilterOption,
  updateEngineFilterOption,
  type LabourPackageOption,
} from "@/lib/actions/pricing";
import type { EngineFilterOption, EngineType } from "@/lib/db/types";

import { LabourPackagePicker } from "../labour-package-picker";

// The filter brands an engine is sold with. Each option is a package, and gets
// its own row — and its own prices — on the oil-change grid, oil detail, print
// list and sales form. Most engines have none and are sold one way.

/** "… With Cat Filter" out of a package name, to pre-fill the option's name. */
function labelFromPackage(name: string): string {
  return /with\s+.*?filter/i.exec(name)?.[0] ?? "";
}

export function EngineFilterOptionsEditor({
  engine,
  options,
  packages,
}: {
  engine: EngineType;
  options: EngineFilterOption[];
  packages: LabourPackageOption[];
}) {
  const engineName = `${engine.manufacturer} ${engine.model}`;
  const [adding, setAdding] = useState(false);
  const [newPackageId, setNewPackageId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [pending, startTransition] = useTransition();

  const linkedPackage = packages.find((p) => p.id === engine.labour_package_id) ?? null;

  const resetAdd = () => {
    setAdding(false);
    setNewPackageId(null);
    setNewLabel("");
    setNewCapacity("");
  };

  const onAdd = () => {
    if (!newPackageId) {
      toast.error("Pick the package for this option.");
      return;
    }
    startTransition(async () => {
      const res = await addEngineFilterOption({
        engine_type_id: engine.id,
        package_id: newPackageId,
        label: newLabel,
        oil_capacity_litres: newCapacity,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Filter option added");
      resetAdd();
    });
  };

  return (
    <div className="space-y-4">
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This engine is sold one way. If customers choose the filter brand, add an option for
          each — every option is a package and gets its own row and prices on the price lists.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Name</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="w-40 text-right">Oil capacity (L)</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map((o) => (
                <OptionRow
                  key={o.id}
                  option={o}
                  engine={engine}
                  packages={packages}
                  isLast={options.length === 1}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {adding ? (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <label className="mb-1 block text-xs font-medium">Package</label>
              <LabourPackagePicker
                engineId={engine.id}
                engineName={engineName}
                value={newPackageId}
                packages={packages}
                onChoose={(id) => {
                  setNewPackageId(id);
                  if (!newLabel.trim()) {
                    setNewLabel(labelFromPackage(packages.find((p) => p.id === id)?.name ?? ""));
                  }
                }}
              />
            </div>
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium">Name</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="With Cat Filter"
              />
            </div>
            <div className="w-36">
              <label className="mb-1 block text-xs font-medium">Oil capacity (L)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                placeholder={Number(engine.oil_capacity_litres).toFixed(2)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={onAdd} disabled={pending || !newPackageId}>
                {pending ? "Adding…" : "Add"}
              </Button>
              <Button type="button" variant="outline" onClick={resetAdd} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave the capacity blank unless this filter changes how much oil the engine takes.
            {options.length === 0 &&
              (linkedPackage
                ? ` The package linked now (${linkedPackage.name}) becomes the first option and keeps this engine's current prices; the new option starts with none.`
                : " This engine's current prices move onto the new option.")}
          </p>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add filter option
        </Button>
      )}
    </div>
  );
}

function OptionRow({
  option,
  engine,
  packages,
  isLast,
}: {
  option: EngineFilterOption;
  engine: EngineType;
  packages: LabourPackageOption[];
  isLast: boolean;
}) {
  const savedCapacity = option.oil_capacity_litres != null ? String(option.oil_capacity_litres) : "";
  const [label, setLabel] = useState(option.label);
  const [capacity, setCapacity] = useState(savedCapacity);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLabel(option.label);
    setCapacity(savedCapacity);
  }, [option.label, savedCapacity]);

  const dirty = label.trim() !== option.label || capacity.trim() !== savedCapacity;

  const save = (packageId: string) => {
    startTransition(async () => {
      const res = await updateEngineFilterOption({
        id: option.id,
        package_id: packageId,
        label,
        oil_capacity_litres: capacity,
      });
      if (!res.ok) toast.error(res.error);
      else toast.success("Filter option saved");
    });
  };

  const remove = () => {
    const name = `${engine.manufacturer} ${engine.model} ${option.label}`;
    const message = isLast
      ? `Remove the last filter option? ${engine.manufacturer} ${engine.model} goes back to being sold one way and keeps this option's package, prices and filters.`
      : `Remove ${name}? Its prices, price locks and filters are deleted and can't be brought back. Sales jobs sold with it stay on the engine.`;
    if (!window.confirm(message)) return;
    startTransition(async () => {
      const res = await removeEngineFilterOption({ id: option.id });
      if (!res.ok) toast.error(res.error);
      else toast.success("Filter option removed");
    });
  };

  return (
    <TableRow>
      <TableCell>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={pending} />
      </TableCell>
      <TableCell>
        <LabourPackagePicker
          engineId={engine.id}
          engineName={`${engine.manufacturer} ${engine.model} ${option.label}`}
          value={option.package_id}
          packages={packages}
          onChoose={save}
          disabled={pending}
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min="0"
          step="0.01"
          className="ml-auto w-28 text-right"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder={Number(engine.oil_capacity_litres).toFixed(2)}
          title="Blank = the engine's own capacity"
          disabled={pending}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {dirty && (
            <Button size="sm" onClick={() => save(option.package_id)} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            title="Remove filter option"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
