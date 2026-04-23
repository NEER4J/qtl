import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  outstanding: "Outstanding",
};

const CLASSES: Record<PaymentStatus, string> = {
  paid: "bg-emerald-600 hover:bg-emerald-600/90 text-white border-transparent",
  partial: "bg-amber-500 hover:bg-amber-500/90 text-white border-transparent",
  outstanding: "bg-rose-600 hover:bg-rose-600/90 text-white border-transparent",
};

export function StatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <Badge className={cn(CLASSES[status], className)}>{LABELS[status]}</Badge>
  );
}
