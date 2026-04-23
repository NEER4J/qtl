"use client";

import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Collapsible "How this works" card. Pin at the top of any page.
 * The open/closed state is remembered per page in localStorage so repeat
 * visitors don't see the same explanation every time.
 */
export function PageHelp({
  id,
  title = "How this works",
  children,
  defaultOpen = false,
}: {
  /** Stable key for localStorage. Use the route, e.g. "sales-list". */
  id: string;
  title?: string;
  children: React.ReactNode;
  /** If true, the card is open on first visit. Otherwise it starts collapsed. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem(`help:${id}`)
      : null;
    if (stored === "open") setOpen(true);
    else if (stored === "closed") setOpen(false);
    setHydrated(true);
  }, [id]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`help:${id}`, next ? "open" : "closed");
    }
  }

  return (
    <div className="rounded-lg border bg-muted/30">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
            !hydrated && "opacity-50",
          )}
        />
      </button>
      {open && (
        <div className="border-t px-4 py-3 text-sm text-muted-foreground leading-relaxed space-y-2 [&_strong]:text-foreground [&_code]:text-foreground [&_code]:font-mono [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1 last:[&_p]:mb-0">
          {children}
        </div>
      )}
    </div>
  );
}
