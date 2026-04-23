"use client";

import { HelpCircle } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Small (?) icon next to a field or label. Click to reveal a short
 * explanation in a popover. Use sparingly — only for genuinely non-obvious
 * fields. For full-page context, use <PageHelp> instead.
 */
export function InfoTip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex text-muted-foreground hover:text-foreground transition-colors align-middle",
            className,
          )}
          aria-label="More info"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-xs text-sm leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
