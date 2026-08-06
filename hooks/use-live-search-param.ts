"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Live, as-you-type search for list pages whose filtering happens on the
 * SERVER (sales, expenses, invoices, the parts catalogue).
 *
 * Those pages used to require pressing a "Search" button: you typed, nothing
 * happened, you hit submit. The customers table already filtered as you typed,
 * so the two behaved differently for no reason a user could see. This makes
 * the server-backed ones behave the same way.
 *
 * It cannot just reuse the customers-table approach, though. That one filters
 * an array already in the browser, so it is free. These pages have to go back
 * to the server for every change, which means three things matter:
 *
 *   * Debounce, and a longer one than a client-side filter needs (the database
 *     is a long way away — see the perf audit). Every fired search is a full
 *     RSC render plus a query.
 *   * router.replace, NOT push. Typing "donaldson" with push would stack nine
 *     history entries and the back button would walk the user through them one
 *     character at a time.
 *   * scroll: false, so the list does not jump to the top mid-keystroke.
 *
 * Returns `searching` covering BOTH the debounce window and the request, so
 * the spinner reflects "your keystroke hasn't landed yet" rather than just
 * "a request is open".
 */
export function useLiveSearchParam({
  param = "q",
  delay = 350,
  extraResets = ["page"],
}: {
  /** Query-string key to drive. */
  param?: string;
  /** Debounce window in ms. */
  delay?: number;
  /** Params cleared alongside a search change — pagination, normally. */
  extraResets?: readonly string[];
} = {}): {
  value: string;
  setValue: (next: string) => void;
  searching: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlValue = searchParams.get(param) ?? "";
  const paramsString = searchParams.toString();

  const [value, setValue] = useState(urlValue);
  const [isPending, startTransition] = useTransition();

  // The last value we ourselves wrote to the URL. Distinguishes "the URL
  // changed because I typed" from "the URL changed underneath me" (back /
  // forward, or a Clear button resetting the whole querystring).
  const lastPushed = useRef(urlValue);

  useEffect(() => {
    if (urlValue !== lastPushed.current) {
      lastPushed.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    if (value === lastPushed.current) return;

    const timer = setTimeout(() => {
      lastPushed.current = value;
      const next = new URLSearchParams(paramsString);
      if (value.trim()) next.set(param, value);
      else next.delete(param);
      for (const key of extraResets) next.delete(key);

      const qs = next.toString();
      startTransition(() =>
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
      );
    }, delay);

    return () => clearTimeout(timer);
    // extraResets is a literal array at every call site; spreading it into the
    // dep list would re-run this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, paramsString, pathname, param, delay, router]);

  return {
    value,
    setValue,
    // Debounce window OR in-flight request — both mean "not showing your
    // latest keystroke yet".
    searching: isPending || value !== lastPushed.current,
  };
}
