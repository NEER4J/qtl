import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (profile.role !== "owner" && profile.role !== "accountant") {
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
    <div className="flex flex-col gap-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} records</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No audit records.</div>
          ) : (
            <Table>
              <TableHeader>
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
