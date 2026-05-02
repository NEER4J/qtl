// Phone number helpers (item #13).
// 10-digit NA numbers, displayed as "xxx-xxx-xxxx". No country code, no
// parentheses, no spaces. If we ever need international we'll swap in
// libphonenumber-js, but for now this matches what the shop actually uses.

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

// Take the last 10 digits and display as "xxx-xxx-xxxx".
// Tolerates legacy data that has a leading "1" country code or other junk.
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = normalizePhone(raw);
  if (digits.length === 0) return "";

  // If 11 digits starting with 1, drop the country code.
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (ten.length === 10) {
    return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
  }
  if (ten.length >= 7) {
    // Partial — format what we have so the input doesn't jump on every keystroke.
    if (ten.length <= 6) return `${ten.slice(0, 3)}-${ten.slice(3)}`;
    return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6, 10)}`;
  }
  if (ten.length >= 4) return `${ten.slice(0, 3)}-${ten.slice(3)}`;
  return ten;
}

// Hard requirement: exactly 10 digits.
export function isValidPhone(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const digits = normalizePhone(raw);
  return digits.length === 10;
}

// For DB search via the customers.phone_search column (digits-only LIKE).
export function digitsOnly(raw: string | null | undefined): string {
  return normalizePhone(raw);
}
