import type { PaymentMode } from "@/lib/db/types";

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  cheque: "Cheque",
  debit: "Debit",
  visa: "Visa",
  mastercard: "Mastercard",
  etransfer: "E-Transfer",
  credit_card: "Credit Card",
  oc: "Outstanding",
};

export function paymentModeLabel(mode: string | null | undefined): string {
  return mode ? PAYMENT_MODE_LABELS[mode as PaymentMode] ?? mode : "—";
}

/** Tenders paid with the customer's credit card, so the card on file applies. */
export function isCardMode(mode: string | null | undefined): boolean {
  return mode === "visa" || mode === "mastercard" || mode === "credit_card";
}

/**
 * The card on file for display: the full number in groups of four, plus the
 * expiry (client 2026-10-20 — full number, never the CVV).
 */
export function formatCardOnFile(
  number: string | null | undefined,
  expiry: string | null | undefined,
): string | null {
  const digits = (number ?? "").replace(/\s+/g, "");
  if (!digits) return null;
  const grouped = /^\d+$/.test(digits) ? digits.replace(/(\d{4})(?=\d)/g, "$1 ") : number!.trim();
  return expiry ? `${grouped} · exp ${expiry}` : grouped;
}
