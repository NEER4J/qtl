"use client";

import Link from "next/link";

import { Command } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { sidebarItems } from "@/navigation/sidebar-items";
import { cn } from "@/lib/utils";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-12 border-b border-gray-200 dark:border-gray-800 p-0">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center h-full hover:opacity-80 transition-opacity",
            isCollapsed ? "justify-center px-2" : "gap-2 px-4"
          )}
        >
          <Command className="size-5 shrink-0" />
          <span
            className={cn(
              "text-base font-semibold transition-opacity",
              isCollapsed && "hidden"
            )}
          >
            {APP_CONFIG.name}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
