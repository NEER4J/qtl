import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  if (profile.role !== "portal_customer") {
    // Internal users don't belong in the portal; bounce them to the app.
    redirect("/dashboard");
  }

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/portal/invoices" className="flex items-center gap-3 font-semibold">
            <Image
              src="/logo.png"
              alt="Quick Truck Lube & Oil"
              width={140}
              height={105}
              className="h-14 w-auto object-contain"
              priority
            />
            <span className="text-muted-foreground text-xs hidden sm:inline">Customer Portal</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{profile.full_name}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="size-4" />
                <span className="ml-1">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">{children}</main>
      <footer className="border-t text-xs text-muted-foreground text-center py-3">
        © Quick Truck Lube & Oil Ltd.
      </footer>
    </div>
  );
}
