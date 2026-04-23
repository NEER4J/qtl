import Link from "next/link";

import { APP_CONFIG } from "@/config/app-config";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="flex w-full flex-1 flex-col items-center gap-20">
        <nav className="flex h-16 w-full justify-center border-b border-border">
          <div className="flex w-full max-w-5xl items-center justify-between p-3 px-5 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <Link href="/" className="text-primary">
                {APP_CONFIG.name}
              </Link>
              <span className="text-muted-foreground hidden font-normal sm:inline">
                {APP_CONFIG.fullName}
              </span>
            </div>
          </div>
        </nav>
        <div className="flex max-w-5xl flex-1 flex-col gap-20 p-5">{children}</div>

        <footer className="mx-auto flex w-full items-center justify-center gap-8 border-t py-16 text-center text-xs">
          <p className="text-muted-foreground">{APP_CONFIG.copyright}</p>
        </footer>
      </div>
    </main>
  );
}
