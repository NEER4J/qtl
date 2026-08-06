"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Prev/next pager for the server-paginated lists (sales, invoices, expenses,
 * customers).
 *
 * There were two near-identical copies of this before, and the invoices table
 * had taken to importing the *sales* one across folders — a third copy for
 * customers was not the answer.
 *
 * The base path comes from usePathname() rather than a prop: passing it by
 * hand is the one thing that can silently break a pager (it links you to
 * another page's list), and the component is always rendered on the route it
 * pages through.
 *
 * Every other query param is preserved, so paging keeps the active filters and
 * search term.
 */
export function ListPagination({
  page,
  pageCount,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  /** Total matching rows. Omit to show only "Page x of y". */
  total?: number;
  pageSize?: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const buildHref = (nextPage: number) => {
    const sp = new URLSearchParams(params);
    sp.set("page", String(nextPage));
    return `${pathname}?${sp.toString()}`;
  };

  const range =
    total != null && pageSize != null && total > 0
      ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`
      : null;

  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground">
        {range ? <>Showing {range} · </> : null}
        Page {page} of {pageCount}
      </div>
      <div className="flex gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page - 1)} scroll={false}>
              Previous
            </Link>
          </Button>
        )}
        {page >= pageCount ? (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page + 1)} scroll={false}>
              Next
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
