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
import { filterSidebarByRole } from "@/navigation/sidebar-items";
import type { UserRole } from "@/lib/db/types";
import { cn } from "@/lib/utils";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({
  user,
  role,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
  readonly role?: UserRole;
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const items = filterSidebarByRole(role);

  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-12 border-b border-border p-0">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center h-full hover:opacity-80 transition-opacity",
            isCollapsed ? "justify-center px-2" : "gap-2 px-4"
          )}
        >
          <Image
            src="/logo.png"
            alt={APP_CONFIG.name}
            width={28}
            height={28}
            className="size-7 shrink-0 object-contain"
            priority
          />
          <span
            className={cn(
              "text-base font-semibold text-foreground transition-opacity",
              isCollapsed && "hidden"
            )}
          >
            {APP_CONFIG.name}
          </span>
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
