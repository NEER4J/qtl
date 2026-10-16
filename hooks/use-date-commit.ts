"use client";

import { useCallback, useEffect, useRef } from "react";

const COMPLETE_DATE = /^(19|20)\d{2}-\d{2}-\d{2}$/;

/**
 * For date boxes that filter a server-rendered list. While a year is typed the
 * browser reports every step (0002, 0020, 0202, 2026), and each one used to
 * navigate: four server renders and four back-button entries per date. This
 * waits until the value is a real date (or cleared) and typing has paused,
 * then commits once.
 */
export function useDateCommit(
  commit: (key: string, value: string) => void,
  delay = 400,
): (key: string, value: string) => void {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Held in a ref so callers can pass an inline function.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return useCallback(
    (key: string, value: string) => {
      clearTimeout(timers.current.get(key));
      if (value && !COMPLETE_DATE.test(value)) return;
      timers.current.set(
        key,
        setTimeout(() => commitRef.current(key, value), delay),
      );
    },
    [delay],
  );
}
