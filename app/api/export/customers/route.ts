import { listCustomersForExport } from "@/lib/actions/customers";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { hiddenColumnsForPage } from "@/lib/permissions/check";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { formatPhone } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

// Same roles as the /customers page itself.
const ALLOWED_ROLES = ["owner", "co_owner", "manager", "staff"];

export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (!ALLOWED_ROLES.includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const rows = await listCustomersForExport(url.searchParams.get("q") ?? undefined);

  const records = rows.map((c) => ({
    code: c.code,
    billing_name: c.billing_name,
    last_or_company: c.last_or_company,
    plates: c.plates.join("; "),
    contact_no: formatPhone(c.contact_no),
    phone_cell: formatPhone(c.phone_cell),
    phone_home: formatPhone(c.phone_home),
    phone_business: formatPhone(c.phone_business),
    phone_fax: formatPhone(c.phone_fax),
    email: c.email,
    address_1: c.address_1,
    address_2: c.address_2,
    city: c.city,
    province: c.province,
    postal_code: c.postal_code,
    country: c.country,
    customer_type: c.customer_type,
    contact_method: c.contact_method,
    active: c.active ? "yes" : "no",
    created: c.created_at?.slice(0, 10) ?? "",
  }));

  // Column hiding is a permission layer, not a display preference — a viewer
  // who cannot see phone/email in the table must not get them via the CSV.
  const hidden = hiddenColumnsForPage(profile, "customers");
  const columns = [
    "code",
    "billing_name",
    "last_or_company",
    "plates",
    ...(hidden.has("phone")
      ? []
      : ["contact_no", "phone_cell", "phone_home", "phone_business", "phone_fax"]),
    ...(hidden.has("email") ? [] : ["email"]),
    "address_1",
    "address_2",
    "city",
    "province",
    "postal_code",
    "country",
    "customer_type",
    "contact_method",
    "active",
    "created",
  ];

  return csvResponse(
    `customers-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(records as unknown as Record<string, unknown>[], columns),
  );
}
