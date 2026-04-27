"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function SalesPagination({
  page,
  pageCount,
  basePath = "/sales",
}: {
  page: number;
  pageCount: number;
  basePath?: string;
}) {
  const params = useSearchParams();

  const buildHref = (nextPage: number) => {
    const sp = new URLSearchParams(params);
    sp.set("page", String(nextPage));
    return `${basePath}?${sp.toString()}`;
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground">
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
