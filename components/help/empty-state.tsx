import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Empty-state block. Use inside a Card or table body when there's nothing to
 * show. Always offer a next action — either a link the user can click, or a
 * plain-English explanation of what to do.
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href: string } | React.ReactNode;
  icon?: typeof Inbox;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-3">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1 max-w-md">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && (
        <div className="mt-1">
          {isActionLink(action) ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {action.label}
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}

function isActionLink(a: unknown): a is { label: string; href: string } {
  return (
    typeof a === "object" &&
    a !== null &&
    "href" in a &&
    "label" in a &&
    typeof (a as { href: unknown }).href === "string"
  );
}

/**
 * Inline hint to drop under a dropdown when it has no options yet.
 * Explains what to do next in plain English with a link to the right page.
 */
export function EmptyDropdownHint({
  message,
  actionLabel,
  href,
}: {
  message: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <p>{message}</p>
      <Link
        href={href}
        className="mt-1 inline-flex items-center gap-1 font-medium hover:underline"
      >
        {actionLabel}
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
