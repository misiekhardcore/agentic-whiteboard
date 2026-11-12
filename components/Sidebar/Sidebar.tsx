import {
  Archive,
  CreditCard,
  LayoutGrid,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from "@konopskidev/ui/components/sidebar";
import { Suspense } from "react";
import { CreateNewBoardDialog } from "@/app/dashboard/_components/CreateNewBoardDialog";
import { WorkspaceUsage } from "./WorkspaceUsage";
import { SidebarMenuLink } from "./SidebarMenuLink";
import { Loading } from "../Loading/Loading";

export function DashboardSidebar() {
  return (
    // The sidebar is `fixed` to the viewport, so it starts below the header and
    // gives up that height; otherwise the footer is pushed past the bottom edge.
    <Sidebar
      className="top-(--app-header-height) h-[calc(100svh-var(--app-header-height))]"
      variant="sidebar"
    >
      <SidebarHeader>Dashboard</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <CreateNewBoardDialog size="sm" className="w-full" />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>My boards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuLink href="/workspaces">
                <LayoutGrid />
                All boards
              </SidebarMenuLink>
              <SidebarMenuLink href="/dashboard/shared">
                <Users />
                Shared
              </SidebarMenuLink>
              <SidebarMenuLink href="/dashboard/archive">
                <Archive />
                Archived
              </SidebarMenuLink>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Others</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuLink href="/dashboard/organization">
                <Users />
                Organizations
              </SidebarMenuLink>
              <SidebarMenuLink href="/dashboard/billing">
                <CreditCard />
                Billing
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
        <SidebarGroup>
          <Suspense fallback={<Loading />}>
            <WorkspaceUsage />
          </Suspense>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
