"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { processRecurringExpenses } from "@/lib/actions/recurring";

export function ProcessRecurringButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function run() {
    setLoading(true);
    const result = await processRecurringExpenses({});
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(
        result.data.generated === 0
          ? "No recurring expenses due right now"
          : `Generated ${result.data.generated} expense${result.data.generated !== 1 ? "s" : ""}`,
      );
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={run} disabled={loading}>
      <Play className="size-4" />
      {loading ? "Processing…" : "Process due"}
    </Button>
  );
}
