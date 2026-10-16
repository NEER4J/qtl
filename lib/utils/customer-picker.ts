// The sales form's customer search, run in the browser over the whole active
// customer list (app/api/picker/customers) instead of one server action per
// settled keystroke. Shared by that route and the combobox so the wire format
// and the matching rules live in one place.

import { digitsOnly } from "@/lib/utils/phone";

/**
 * One customer on the wire: [id, billing_name, last_or_company, phone_search,
 * vehicle plates, legacy plates_text]. A tuple rather than an object because
 * the list is ~4.5k rows. `last_or_company` is null when it repeats
 * billing_name, which it usually does.
 */
export type CustomerPickerTuple = [
  string,
  string | null,
  string | null,
  string | null,
  string[],
  string | null,
];

export interface CustomerPickerRow {
  id: string;
  billing_name: string | null;
  last_or_company: string | null;
  /** Active vehicles' plates, else the legacy customers.license_plates. */
  plates: string[];
  phone_search: string;
  /** Lower-cased name, company and plates (also without spaces or dashes). */
  haystack: string;
}

export function decodeCustomerPicker(tuples: CustomerPickerTuple[]): CustomerPickerRow[] {
  return tuples.map(([id, billing, company, phones, plates, legacy]) => {
    const shownPlates = plates.length > 0 ? plates : legacy ? [legacy] : [];
    const allPlates = [...plates, legacy ?? ""];
    return {
      id,
      billing_name: billing,
      last_or_company: company ?? billing,
      plates: shownPlates,
      phone_search: phones ?? "",
      haystack: [
        billing,
        company,
        ...allPlates,
        // "B628AN" should find "B62 8AN".
        ...allPlates.map((p) => p.replace(/[\s-]/g, "")),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });
}

/**
 * Everything searchCustomers finds, without the round trip. It matched the
 * whole query as one substring of the name, company or a vehicle plate, or its
 * digits (3+) inside phone_search. Here each word only has to appear
 * somewhere, which keeps every one of those hits and adds "transport 021" for
 * "021 TRANSPORT INC". Rows arrive sorted by billing_name, as before.
 */
export function searchCustomerPicker(
  rows: CustomerPickerRow[],
  rawQuery: string,
  limit: number,
): CustomerPickerRow[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return rows.slice(0, limit);

  const words = q.split(/\s+/);
  const digits = digitsOnly(q);
  const out: CustomerPickerRow[] = [];
  for (const row of rows) {
    const hit =
      words.every((w) => row.haystack.includes(w)) ||
      (digits.length >= 3 && row.phone_search.includes(digits));
    if (hit) {
      out.push(row);
      if (out.length === limit) break;
    }
  }
  return out;
}
