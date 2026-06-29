import Image from "next/image";
import { ReactNode } from "react";

import { MapPin } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { APP_CONFIG } from "@/config/app-config";

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <div className="bg-primary relative order-2 hidden h-full overflow-hidden rounded-3xl lg:flex">
          <div className="relative z-10 flex w-full flex-col">
            <div className="text-primary-foreground absolute top-10 space-y-3 px-10">
              <div className="rounded-2xl bg-white p-4 inline-block">
                <Image
                  src="/logo.png"
                  alt={APP_CONFIG.fullName}
                  width={220}
                  height={170}
                  className="h-32 w-auto object-contain"
                  priority
                />
              </div>
              <p className="text-primary-foreground/95 text-sm font-medium">{APP_CONFIG.fullName}</p>
            </div>

            <div className="absolute bottom-10 flex w-full justify-between px-10">
              <div className="text-primary-foreground flex-1 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <MapPin className="size-4 shrink-0 opacity-90" aria-hidden />
                  Three locations
                </div>
                <p className="text-primary-foreground/85 text-sm">
                  Ayr, Fort Erie, and Napanee — one system for jobs, invoices, expenses, and payroll.
                </p>
              </div>
              <Separator orientation="vertical" className="mx-3 !h-auto bg-primary-foreground/20" />
              <div className="text-primary-foreground flex-1 space-y-1">
                <h2 className="font-medium">Role-based access</h2>
                <p className="text-primary-foreground/85 text-sm">
                  Owners, managers, accountants, and staff each see the tools and data they need.
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
