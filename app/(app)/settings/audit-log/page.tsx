import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { requireProfile } from "@/lib/auth/require";
import { listAuditLog } from "@/lib/actions/audit";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const ACTION_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  insert: "default",
  update: "secondary",
  delete: "destructive",
  deactivate: "destructive",
  reactivate: "outline",
  login: "outline",
  export: "secondary",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  if ((profile.role !== "owner" && profile.role !== "co_owner") && profile.role !== "accountant") {
    notFound();
  }

  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const { rows, total } = await listAuditLog({
    table_name: sp.table ?? undefined,
    action: sp.action ?? undefined,
    from: sp.from ?? undefined,
    to: sp.to ?? undefined,
    page,
    pageSize: 50,
  });

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} records</p>
      </div>

      <PageHelp id="settings-audit">
        <p>
          Every create, edit, and deactivate across the system is logged here. The columns tell you:
        </p>
        <ul>
          <li><strong>Time</strong> — when it happened.</li>
          <li><strong>Table</strong> — the kind of record (a sales job, an expense, a user, a payroll entry, and so on).</li>
          <li><strong>Action</strong> — whether the record was created, edited, deactivated, or reactivated.</li>
          <li><strong>Record ID</strong> — the unique identifier of that record, so you can find it again.</li>
          <li><strong>Actor</strong> — who did it. Blank means the record came in during the initial Excel import.</li>
          <li><strong>Role</strong> — what role that person had when they did it.</li>
        </ul>
        <p>
          A full before-and-after snapshot is stored with every entry for reference. Owner and accountant only.
        </p>
      </PageHelp>

      <Card>
        <CardContent className="p-0 max-h-[calc(100vh-220px)] overflow-auto">
          {rows.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">
              <p className="font-medium text-foreground">Nothing to show yet.</p>
              <p className="mt-1">Audit entries appear here as people create, edit, and deactivate records across the system.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(r.at).toLocaleString("en-CA", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.table_name}</TableCell>
                    <TableCell>
                      <Badge variant={ACTION_COLORS[r.action] ?? "outline"} className="text-xs">
                        {r.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">
                      {r.record_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">
                      {r.actor_id ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.actor_role ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?page=${page - 1}`} className="px-3 py-1 border rounded hover:bg-muted">
                Previous
              </a>
            )}
            {page < totalPages && (
              <a href={`?page=${page + 1}`} className="px-3 py-1 border rounded hover:bg-muted">
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
