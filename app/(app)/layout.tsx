import { ReactNode, Suspense } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { TopProgressBar } from "@/components/top-progress-bar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { SearchDialog } from "@/components/sidebar/search-dialog";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const profile = await getCurrentProfile();
  if (!profile) {
    // Auth user exists but no profile yet (race) — send to login to retry.
    redirect("/auth/login");
  }
  if (!profile.active) redirect("/auth/login?error=account_disabled");
  if (profile.role === "portal_customer") redirect("/portal/invoices");

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const userData = {
    id: user.id,
    name: profile.full_name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    avatar: (user.user_metadata?.avatar_url as string | undefined) || "",
  };

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
      <AppSidebar
        variant="sidebar"
        collapsible="icon"
        role={profile.role}
        user={{
          name: userData.name,
          email: userData.email,
          avatar: userData.avatar,
        }}
      />
      <SidebarInset
        className={cn(
          "max-w-full",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b border-border transition-[width,height] ease-linear",
            "sticky top-0 z-50 bg-background/60 backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
              <SearchDialog />
            </div>
          </div>
        </header>
        <div className="h-full p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
