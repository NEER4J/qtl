"use client";

import { useState } from "react";
import { Download, DownloadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BackupTable } from "@/lib/utils/backup-tables";

const href = (name: string) => `/api/export/backup?table=${encodeURIComponent(name)}`;

function startDownload(name: string) {
  const a = document.createElement("a");
  a.href = href(name);
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function BackupDownloads({ tables }: { tables: BackupTable[] }) {
  const [running, setRunning] = useState<number | null>(null);

  // One file per table, a moment apart — browsers drop downloads fired all at
  // once. The first time, Chrome asks to "allow multiple downloads": allow it.
  const downloadAll = async () => {
    for (let i = 0; i < tables.length; i++) {
      setRunning(i + 1);
      startDownload(tables[i]!.name);
      await new Promise((r) => setTimeout(r, 1500));
    }
    setRunning(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={downloadAll} disabled={running != null}>
          <DownloadCloud className="size-4" />
          {running != null ? `Downloading ${running} of ${tables.length}…` : "Download full backup"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {tables.length} files, one per table. Keep the browser open until it finishes.
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <li key={t.name} className="flex items-center justify-between gap-2 bg-card px-3 py-2 text-sm">
            <span className="truncate">{t.label}</span>
            <Button asChild variant="ghost" size="sm">
              <a href={href(t.name)} download>
                <Download className="size-4" /> CSV
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
