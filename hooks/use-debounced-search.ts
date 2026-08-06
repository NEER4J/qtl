"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared search behaviour for every combobox / picker in the app.
 *
 * Why this exists: each picker used to fire its server action from a bare
 * `useEffect([q, open])`, i.e. ONE round trip per keystroke. Next.js queues
 * server-action calls, so typing "FRAM PH8A" fired nine requests that ran one
 * after another — the last result landed long after the user stopped typing,
 * and because nothing tracked request order an older response could overwrite
 * a newer one (results visibly flipping backwards).
 *
 * This hook fixes both:
 *   * debounce — only the query the user actually settled on is sent;
 *   * stale-response guard — every request carries a monotonic id and a
 *     response is dropped unless it belongs to the newest one.
 *
 * `searching` is true from the first keystroke until the matching response
 * lands (not just while the request is in flight), so the spinner tracks what
 * the user perceives rather than what the network is doing.
 */
export function useDebouncedSearch<T>({
  open,
  query,
  fetcher,
  delay = 200,
  deps = [],
}: {
  /** Only fetch while the popover is open. */
  open: boolean;
  /** The raw, undebounced input value. */
  query: string;
  /** Runs on the settled query. Must resolve to the result list. */
  fetcher: (query: string) => Promise<T[]>;
  /** Debounce window in ms. The empty query (initial open) skips it. */
  delay?: number;
  /** Extra values that should also re-trigger the search (e.g. a category filter). */
  deps?: readonly unknown[];
}): { results: T[]; searching: boolean; reset: () => void } {
  const [results, setResults] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);

  // Held in a ref so callers can pass an inline arrow without memoising it —
  // otherwise every parent render would restart the debounce.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Monotonic request id. Bumping it invalidates every response still in
  // flight, which is how both the stale-guard and `reset()` cancel work.
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setResults([]);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (!open) {
      // Closing invalidates anything in flight so a late response can't
      // repopulate a picker the user already dismissed.
      requestIdRef.current += 1;
      setSearching(false);
      return;
    }

    setSearching(true);

    // Opening the picker with an empty box is the "show me the first N" case —
    // there is nothing to debounce, so fetch immediately.
    const wait = query.trim().length > 0 ? delay : 0;

    const timer = setTimeout(() => {
      const id = ++requestIdRef.current;
      void (async () => {
        try {
          const data = await fetcherRef.current(query);
          if (id !== requestIdRef.current) return; // superseded — drop it
          setResults(data);
        } catch {
          if (id !== requestIdRef.current) return;
          setResults([]);
        } finally {
          if (id === requestIdRef.current) setSearching(false);
        }
      })();
    }, wait);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, delay, ...deps]);

  return { results, searching, reset };
}
