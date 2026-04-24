"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EngineType } from "@/lib/db/types";

import { EngineTypeFormDialog } from "../engine-type-form-dialog";

export function EngineDetailHeader({ engine }: { engine: EngineType }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="size-4" /> Edit engine
      </Button>
      <EngineTypeFormDialog
        open={editing}
        onOpenChange={setEditing}
        mode="edit"
        engineType={engine}
      />
    </>
  );
}
