"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) once on the client so the app is
 * an installable PWA — the browser then offers "Install app" (desktop / Android)
 * and "Add to Home Screen" (iOS) with the shortcuts from app/manifest.ts.
 * Renders nothing.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore — the app works without it; this only enables install prompts.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
