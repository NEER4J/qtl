import { ReactNode } from "react";

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";
import { APP_CONFIG } from "@/config/app-config";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ThemeProvider } from "next-themes";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
  applicationName: "QTL",
  // Installable-app hints so iOS/Android/desktop can add it to the home
  // screen / dock with a shortcut. The manifest (app/manifest.ts) is auto-linked
  // by Next.js and carries the name, icons, start_url and jump-list shortcuts.
  appleWebApp: {
    capable: true,
    title: "QTL",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className={`${inter.className} min-h-screen antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
            <PwaRegister />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
