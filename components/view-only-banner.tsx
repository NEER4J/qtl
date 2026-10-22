"use client";

import { usePathname } from "next/navigation";

import { pageKeyForRequestPath } from "@/lib/permissions/registry";

/**
 * "View only" notice above the page (client 2026-10-20): the role could change
 * things here, but an admin switched this person's Update off. Saves are
 * refused server-side (wrapAction `page`); this says so before they try.
 *
 * Worked out from the current URL in the browser: the (app) layout that renders
 * it is shared, and Next.js doesn't re-render a shared layout when moving
 * between its pages, so a server-side check would keep showing whatever the
 * first page loaded said.
 */
export function ViewOnlyBanner({ viewOnlyPages }: { viewOnlyPages: readonly string[] }) {
  const pathname = usePathname();
  const pageKey = pageKeyForRequestPath(pathname ?? "");
  if (!pageKey || !viewOnlyPages.includes(pageKey)) return null;
  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 print:hidden">
      <strong>View only.</strong> You can look at this page but not change anything here — ask an admin to turn on Update for you.
    </div>
  );
}
