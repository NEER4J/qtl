import { AuthorizationError } from "@/lib/auth/require";
import { getCustomerMonthlyStatement } from "@/lib/actions/statements";
import { MONTH_RE, previousMonth } from "@/lib/utils/statement";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A customer's monthly statement as a PDF (client 2026-10-20), rendered on
 * request like the invoice (app/api/invoices/[id]/pdf): `?month=YYYY-MM`
 * (default: last month), `&download=1` to save instead of show.
 */
export async function GET(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  if (!UUID_RE.test(customerId)) return new Response("Customer not found", { status: 404 });
  const url = new URL(req.url);
  const rawMonth = url.searchParams.get("month");
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : previousMonth(todayISO());

  let statement;
  try {
    statement = await getCustomerMonthlyStatement(customerId, month);
  } catch (err) {
    if (err instanceof AuthorizationError) return new Response(err.message, { status: 403 });
    throw err;
  }
  if (!statement) return new Response("Customer not found", { status: 404 });

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { buildStatementDoc } = await import("@/components/pdf/StatementPdf");
  const buffer = await renderToBuffer(buildStatementDoc(statement));

  const download = url.searchParams.get("download") === "1";
  const safeName = statement.customer.name.replace(/[^A-Za-z0-9-_]+/g, "_").slice(0, 60);
  const filename = `statement-${safeName}-${month}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
