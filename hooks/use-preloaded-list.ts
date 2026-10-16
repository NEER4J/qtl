"use client";

import { useEffect, useState } from "react";

// Lists the sales form searches in the browser (customers, parts, Trans &
// Diff), each loaded with one GET and kept at module level so it survives
// closing a picker and moving between jobs. Opening a picker shows the copy it
// has at once; a copy older than `maxAgeMs` is refreshed in the background.
//
// Plain fetch to a route handler, not a server action: Next runs actions one
// at a time, so a 4.5k-row load in that queue would hold up every action
// behind it (the customer context read that follows a pick, price lookups).

type Entry = { at: number; data: unknown };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export function loadPreloadedList<T>(url: string): Promise<T> {
  let p = inflight.get(url);
  if (!p) {
    p = fetch(url, { cache: "no-store" })
      .then((res) => {
        // An expired session redirects to the login page, whose HTML fails
        // res.json() below and lands in the same error path.
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        store.set(url, { at: Date.now(), data });
        return data;
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p as Promise<T>;
}

/** Warm a list ahead of use (form mount, hover). Never throws. */
export function prefetchPreloadedList(url: string, maxAgeMs: number): void {
  const entry = store.get(url);
  if (entry && Date.now() - entry.at < maxAgeMs) return;
  loadPreloadedList(url).catch(() => {});
}

/**
 * The list at `url`, loaded or refreshed when `open` turns true. `data` is
 * null only until the first load lands; `failed` means that first load (or a
 * refresh) failed, so callers should only show it while `data` is null.
 */
export function usePreloadedList<T>(
  url: string,
  { open, maxAgeMs }: { open: boolean; maxAgeMs: number },
): { data: T | null; failed: boolean } {
  const [data, setData] = useState<T | null>(() => (store.get(url)?.data as T | undefined) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const entry = store.get(url);
    if (entry) setData(entry.data as T);
    if (entry && Date.now() - entry.at < maxAgeMs) return;
    let live = true;
    setFailed(false);
    loadPreloadedList<T>(url).then(
      (fresh) => live && setData(fresh),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [open, url, maxAgeMs]);

  return { data, failed };
}
