"use client";

import Link from "next/link";

import { Truck } from "lucide-react";

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
          <Truck className="size-5 shrink-0 text-primary" aria-hidden />
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
