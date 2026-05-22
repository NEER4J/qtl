"use client";

import Image from "next/image";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { filterSidebar } from "@/navigation/sidebar-items";
import type { UserRole } from "@/lib/db/types";
import { cn } from "@/lib/utils";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({
  user,
  role,
  allowedPages,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
  readonly role?: UserRole;
  readonly allowedPages?: string[] | null;
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const items = filterSidebar(role, allowedPages);

  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-20 border-b border-border p-0">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center justify-center h-full hover:opacity-80 transition-opacity",
            isCollapsed ? "px-1" : "px-3"
          )}
        >
          <Image
            src="/logo.png"
            alt={APP_CONFIG.name}
            width={160}
            height={120}
            className={cn(
              "object-contain",
              isCollapsed ? "size-10" : "h-16 w-auto max-w-full"
            )}
            priority
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
