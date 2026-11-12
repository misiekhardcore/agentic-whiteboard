"use client";

import {
  Archive,
  Building2,
  LayoutGrid,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@konopskidev/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@konopskidev/ui/components/sidebar";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function DashboardSidebar({ footer }: { footer?: ReactNode }) {
  return (
    // The sidebar is `fixed` to the viewport, so it starts below the header and
    // gives up that height; otherwise the footer is pushed past the bottom edge.
    <Sidebar
      className="top-(--app-header-height) h-[calc(100svh-var(--app-header-height))] min-h-0"
      variant="sidebar"
    >
      <SidebarHeader>Dashboard</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Button size="sm" className="w-full">
              + Create new board
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>My boards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <LayoutGrid />
                  All boards
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Users />
                  Shared
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Archive />
                  Archived
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Others</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuLink href="/dashboard/team">
                <Building2 />
                Team &amp; billing
              </SidebarMenuLink>
              <SidebarMenuLink href={"/dashboard/ai-helper"}>
                <Sparkles />
                AI Helper
              </SidebarMenuLink>
              <SidebarMenuLink href="/dashboard/settings">
                <Settings />
                Settings
              </SidebarMenuLink>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {footer ? (
        <SidebarFooter className="border-t p-0">{footer}</SidebarFooter>
      ) : null}
    </Sidebar>
  );
}

function SidebarMenuLink({
  children,
  href,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={pathname.startsWith(href)}>
        <Link href={href}>{children}</Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
