import { ReactNode } from "react";

import { Command } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { APP_CONFIG } from "@/config/app-config";

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <div className="bg-blue-600 dark:bg-blue-500 relative order-2 hidden h-full rounded-3xl lg:flex overflow-hidden">
         
          
          {/* Content overlay */}
          <div className="relative z-10 flex flex-col w-full">
            <div className="text-white absolute top-10 space-y-1 px-10">
              <Command className="size-10" />
              <h1 className="text-2xl font-medium">{APP_CONFIG.name}</h1>
              <p className="text-sm">A starter template for shipping your SaaS faster.</p>
            </div>

            <div className="absolute bottom-10 flex w-full justify-between px-10">
              <div className="text-white flex-1 space-y-1">
                <h2 className="font-medium">Authentication included</h2>
                <p className="text-sm">Email/password and Google OAuth via Supabase, plus verification and password reset flows.</p>
              </div>
              <Separator orientation="vertical" className="mx-3 !h-auto bg-white/20" />
              <div className="text-white flex-1 space-y-1">
                <h2 className="font-medium">Dashboard foundation</h2>
                <p className="text-sm">
                  A responsive sidebar layout and protected routes—ready for billing, teams, and your product features.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative order-1 flex h-full">{children}</div>
      </div>
    </main>
  );
}
