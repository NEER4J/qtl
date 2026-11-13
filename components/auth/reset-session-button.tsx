"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

// A quiet escape hatch under the login box. A stale or corrupted session cookie
// can leave sign-in stuck; this wipes the site's cookies and local data (what
// "clear cookies" in the browser does) and reloads a clean login page.
export function ResetSessionButton() {
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    try {
      await fetch("/auth/reset", { method: "POST", cache: "no-store" });
    } catch {
      // Offline or blocked — still clear what we can from here.
    }
    try {
      for (const part of document.cookie.split(";")) {
        const name = part.split("=")[0]?.trim();
        if (name) document.cookie = `${name}=; path=/; max-age=0`;
      }
    } catch {}
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.replace("/auth/login");
  };

  return (
    <div className="space-y-1.5 text-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={reset}
        disabled={busy}
        className="text-muted-foreground w-full"
      >
        <RotateCcw className={busy ? "animate-spin" : ""} />
        {busy ? "Resetting…" : "Reset saved login data"}
      </Button>
      <p className="text-muted-foreground/70 text-xs pt-2">
        Stuck? Resetting browser's saved cookies will help.
      </p>
    </div>
  );
}
