import type { MetadataRoute } from "next";

// Web-app manifest — makes the app installable (desktop / mobile PWA) and adds
// jump-list "shortcuts" to the installed icon: right-click the app icon (or
// long-press) to jump straight to New sale / New expense / Inventory.
// (client 2026-06-30 — "shortcut option on the desktop app PWA".)
// Next.js auto-serves this at /manifest.webmanifest and links it in <head>.
export default function manifest(): MetadataRoute.Manifest {
  const icon = { src: "/logo.png", sizes: "any", type: "image/png" };
  return {
    name: "QTL — Quick Truck Lube & Oil",
    short_name: "QTL",
    description: "Quick Truck Lube — pricing, sales, inventory and payroll.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [{ ...icon, purpose: "any" }, { ...icon, purpose: "maskable" }],
    shortcuts: [
      { name: "New sale", short_name: "New sale", url: "/sales/new", icons: [icon] },
      { name: "New expense", short_name: "New expense", url: "/expenses/new", icons: [icon] },
      { name: "Inventory", short_name: "Inventory", url: "/inventory", icons: [icon] },
      { name: "Dashboard", short_name: "Dashboard", url: "/dashboard", icons: [icon] },
    ],
  };
}
