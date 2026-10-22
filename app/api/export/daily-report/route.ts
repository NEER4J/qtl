import { getDailyJobReport } from "@/lib/actions/reports";
import { listLocations } from "@/lib/actions/locations";
import { requireProfile } from "@/lib/auth/require";
import { canChooseLocation } from "@/lib/auth/locations";
import { isPageAllowed } from "@/lib/permissions/check";
import { pageKeyForRequestPath } from "@/lib/permissions/registry";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { formatTime } from "@/lib/utils/format";
import { paymentModeLabel } from "@/lib/utils/payment-modes";
import { ISO_DATE_RE, todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toFixed(2);

/**
 * The whole day as a spreadsheet (client 2026-10-20 — "basically the whole
 * day's data"): summary, payment methods, every job with its payments, the
 * payments taken that day, parts used. Same filters as /reports/daily.
 */
export async function GET(req: Request) {
  // API routes sit outside the (app) layout's page gate, so check it here.
  const profile = await requireProfile();
  if (!isPageAllowed(profile, pageKeyForRequestPath("/reports/daily") ?? "reports")) {
    return new Response("You don't have access to Reports.", { status: 403 });
  }

  const url = new URL(req.url);
  const rawDate = url.searchParams.get("date");
  const date = rawDate && ISO_DATE_RE.test(rawDate) ? rawDate : todayISO();
  // Same rule as the page: a single-shop user is pinned to theirs.
  const locationId = canChooseLocation(profile)
    ? url.searchParams.get("location_id") || null
    : profile.location_id;
  const customerStatus = url.searchParams.get("customer_status");

  const [report, locations] = await Promise.all([
    getDailyJobReport(date, locationId),
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
  sections.push(`# Daily report — ${date} — ${locationName}`);
  if (customerStatus) sections.push(`# Jobs filtered to ${customerStatus} customers`);
  sections.push("");
  sections.push("## Summary");
  sections.push(
    toCsv(
      [
        { item: "Jobs", value: t.job_count },
        { item: "Sub total", value: money(t.sub_total) },
        { item: "HST", value: money(t.hst) },
        { item: "Total", value: money(t.total) },
        { item: "Paid", value: money(t.paid) },
        { item: "Store credit applied", value: money(t.credit_applied) },
        { item: "Outstanding", value: money(t.outstanding) },
        { item: "Payments received today", value: money(t.received) },
        { item: "Payments received today — count", value: t.received_count },
        { item: "Payments received today — on older invoices", value: money(t.received_older) },
      ],
      ["item", "value"],
    ),
  );
  sections.push("");

  sections.push("## By payment method");
  sections.push(
    toCsv(
      report.by_payment_method.map((m) => ({
        method: m.mode ? paymentModeLabel(m.mode) : "Not recorded",
        todays_jobs: m.jobs_count,
        todays_jobs_amount: money(m.jobs_amount),
        received_today: m.received_count,
        received_today_amount: money(m.received_amount),
      })),
      ["method", "todays_jobs", "todays_jobs_amount", "received_today", "received_today_amount"],
    ),
  );
  sections.push("");

  sections.push("## Jobs");
  sections.push(
    toCsv(
      jobs.map((j) => ({
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
    toCsv(
      report.payments_received.map((p) => ({
        paid_on: p.paid_on,
        entered_at: p.created_at ? formatTime(p.created_at) : "",
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
    toCsv(
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

  return csvResponse(`daily-report-${date}.csv`, sections.join("\n"));
}
