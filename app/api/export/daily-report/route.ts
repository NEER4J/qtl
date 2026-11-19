import { getDailyJobReport } from "@/lib/actions/reports";
import { listLocations } from "@/lib/actions/locations";
import { requireProfile } from "@/lib/auth/require";
import { canChooseLocation } from "@/lib/auth/locations";
import { isPageAllowed } from "@/lib/permissions/check";
import { pageKeyForRequestPath } from "@/lib/permissions/registry";
import { csvResponse, toReportCsv } from "@/lib/utils/csv";
import { resolveDetailRange } from "@/lib/utils/date-range";
import { formatDateTime } from "@/lib/utils/format";
import { paymentModeLabel } from "@/lib/utils/payment-modes";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toFixed(2);

/**
 * The whole period as a spreadsheet (client 2026-10-20 — "basically the whole
 * day's data"): summary, payment methods, every job with its payments, the
 * payments taken in it, parts used. Same filters as /reports/daily, From–To
 * included; every job and payment row carries its date.
 */
export async function GET(req: Request) {
  // API routes sit outside the (app) layout's page gate, so check it here.
  const profile = await requireProfile();
  if (!isPageAllowed(profile, pageKeyForRequestPath("/reports/daily") ?? "reports")) {
    return new Response("You don't have access to Reports.", { status: 403 });
  }

  const url = new URL(req.url);
  const { from, to } = resolveDetailRange({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    date: url.searchParams.get("date"),
  });
  const period = from === to ? from : `${from} to ${to}`;
  // Same rule as the page: a single-shop user is pinned to theirs.
  const locationId = canChooseLocation(profile)
    ? url.searchParams.get("location_id") || null
    : profile.location_id;
  const customerStatus = url.searchParams.get("customer_status");

  const [report, locations] = await Promise.all([
    getDailyJobReport(from, to, locationId),
    listLocations(),
  ]);
  const jobs = customerStatus
    ? report.jobs.filter((j) => j.customer_status === customerStatus)
    : report.jobs;
  const locationName = locationId
    ? (locations.find((l) => l.id === locationId)?.name ?? "")
    : "All locations";

  const t = report.totals;
  const sections: string[] = [];
  sections.push(`# Daily report — ${period} — ${locationName}`);
  if (customerStatus) sections.push(`# Jobs filtered to ${customerStatus} customers`);
  sections.push("");
  sections.push("## Summary");
  sections.push(
    toReportCsv(
      [
        { item: "Jobs", value: t.job_count },
        { item: "Sub total", value: money(t.sub_total) },
        { item: "HST", value: money(t.hst) },
        { item: "Total", value: money(t.total) },
        { item: "Paid", value: money(t.paid) },
        { item: "Store credit applied", value: money(t.credit_applied) },
        { item: "Outstanding", value: money(t.outstanding) },
        { item: "Payments received", value: money(t.received) },
        { item: "Payments received — count", value: t.received_count },
        { item: "Payments received — on invoices dated before the period", value: money(t.received_older) },
      ],
      ["item", "value"],
    ),
  );
  sections.push("");

  sections.push("## By payment method");
  sections.push(
    toReportCsv(
      report.by_payment_method.map((m) => ({
        method: m.mode ? paymentModeLabel(m.mode) : "Not recorded",
        jobs: m.jobs_count,
        jobs_amount: money(m.jobs_amount),
        received: m.received_count,
        received_amount: money(m.received_amount),
      })),
      ["method", "jobs", "jobs_amount", "received", "received_amount"],
    ),
  );
  sections.push("");

  sections.push("## Jobs");
  sections.push(
    toReportCsv(
      jobs.map((j) => ({
        date: j.job_date,
        time: j.start_time?.slice(0, 5) ?? "",
        invoice_no: j.invoice_no,
        location: j.location_code ?? "",
        customer: j.customer_name ?? "",
        customer_status: j.customer_status ?? "",
        plate: j.plate ?? "",
        vehicle: j.vehicle_label ?? "",
        unit_no: j.unit_no ?? "",
        service: j.service_code ?? "",
        service_name: j.service_name ?? "",
        odometer: j.odometer ?? "",
        upper_tech: j.upper_tech ?? "",
        lower_tech: j.lower_tech ?? "",
        advisor: j.advisor_name ?? "",
        sub_total: money(j.sub_total),
        hst: money(j.hst),
        total: money(j.total),
        paid: money(j.paid_amount),
        payment_methods: j.payments
          .map((p) => `${paymentModeLabel(p.mode)} ${money(p.amount)}`)
          .join("; "),
        store_credit: money(j.credit_applied),
        outstanding: money(j.outstanding),
        status: j.payment_status,
      })),
      [
        "date",
        "time",
        "invoice_no",
        "location",
        "customer",
        "customer_status",
        "plate",
        "vehicle",
        "unit_no",
        "service",
        "service_name",
        "odometer",
        "upper_tech",
        "lower_tech",
        "advisor",
        "sub_total",
        "hst",
        "total",
        "paid",
        "payment_methods",
        "store_credit",
        "outstanding",
        "status",
      ],
    ),
  );
  sections.push("");

  sections.push("## Payments received");
  sections.push(
    toReportCsv(
      report.payments_received.map((p) => ({
        paid_on: p.paid_on,
        entered_at: p.created_at ? formatDateTime(p.created_at) : "",
        invoice_no: p.invoice_no,
        invoice_date: p.job_date,
        older_invoice: p.older_invoice ? "yes" : "",
        location: p.location_code ?? "",
        customer: p.customer_name ?? "",
        method: paymentModeLabel(p.mode),
        reference: p.reference ?? "",
        amount: money(p.amount),
        notes: p.legacy ? "Recorded on the invoice (no payment entry)" : (p.notes ?? ""),
      })),
      [
        "paid_on",
        "entered_at",
        "invoice_no",
        "invoice_date",
        "older_invoice",
        "location",
        "customer",
        "method",
        "reference",
        "amount",
        "notes",
      ],
    ),
  );
  sections.push("");

  sections.push("## Parts used");
  sections.push(
    toReportCsv(
      report.parts_used.map((p) => ({
        part_number: p.part_number ?? "",
        brand: p.brand ?? "",
        description: p.description,
        qty: p.qty_total,
        revenue: money(p.revenue),
      })),
      ["part_number", "brand", "description", "qty", "revenue"],
    ),
  );

  return csvResponse(
    `daily-report-${from === to ? from : `${from}_to_${to}`}.csv`,
    sections.join("\n"),
  );
}
