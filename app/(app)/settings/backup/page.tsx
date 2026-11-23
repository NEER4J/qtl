import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { requirePage } from "@/lib/auth/require";
import { BACKUP_TABLES } from "@/lib/utils/backup-tables";

import { BackupDownloads } from "./backup-downloads";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  await requirePage("settings_backup");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backup</h1>
        <p className="text-sm text-muted-foreground">
          Download a copy of all the shop&apos;s data to this computer.
        </p>
      </div>

      <PageHelp id="settings-backup">
        <p>
          The data lives in the online database, which keeps its own backups. This page gives you
          your own copy as well: every table as a spreadsheet (CSV) file you can open in Excel.
        </p>
        <ul>
          <li>Press <strong>Download full backup</strong> every day or every other day and keep the files in a dated folder.</li>
          <li>Chrome may ask to <strong>allow multiple downloads</strong> the first time. Allow it, or nothing after the first file arrives.</li>
          <li>The change history (Audit Log) is not included: it is very large and not needed to restore the business.</li>
        </ul>
      </PageHelp>

      <Card>
        <CardHeader><CardTitle>Tables</CardTitle></CardHeader>
        <CardContent>
          <BackupDownloads tables={BACKUP_TABLES} />
        </CardContent>
      </Card>
    </div>
  );
}
