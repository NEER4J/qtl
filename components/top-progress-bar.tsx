"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runningRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const start = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    clearTimers();
    setVisible(true);
    setProgress(10);
    const tick = (next: number, delay: number) => {
      timersRef.current.push(
        setTimeout(() => setProgress(next), delay),
      );
    };
    tick(35, 120);
    tick(60, 320);
    tick(80, 700);
    tick(90, 1400);
  };

  const finish = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    clearTimers();
    setProgress(100);
    timersRef.current.push(
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250),
    );
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;

      const anchor = target as HTMLAnchorElement;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }

      start();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // When pathname or search params change, finish the bar.
  useEffect(() => {
    finish();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-1">
      <div
        className={cn(
          "h-full bg-primary shadow-[0_0_10px_2px] shadow-primary/60 transition-[width,opacity] duration-200 ease-out",
          progress >= 100 ? "opacity-0" : "opacity-100",
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
