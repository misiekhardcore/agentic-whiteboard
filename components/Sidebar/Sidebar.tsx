import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from "@konopskidev/ui/components/sidebar";
import {
  Archive,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { Suspense } from "react";

import { CreateWorkspaceDialog } from "@/app/dashboard/_components/CreateWorkspaceDialog";
import { routes } from "@/lib/shared/routes";

import { Loading } from "../Loading/Loading";

import { SidebarMenuLink } from "./SidebarMenuLink";
import { WorkspaceUsage } from "./WorkspaceUsage";

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
            <CreateWorkspaceDialog size="sm" className="w-full" />
          </SidebarGroupContent>
        </SidebarGroup>
        {/* The dashboard is the home surface, so it is named before the lists
            that live under it. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuLink href={routes.dashboard} exact>
                <LayoutDashboard />
                Dashboard
              </SidebarMenuLink>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>My workspaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuLink href={routes.workspaces}>
                <LayoutGrid />
                All workspaces
              </SidebarMenuLink>
              <SidebarMenuLink href={routes.dashboardShared}>
                <Users />
                Shared
              </SidebarMenuLink>
              <SidebarMenuLink href={routes.dashboardArchive}>
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
              <SidebarMenuLink href={routes.dashboardOrganization}>
                <Users />
                Organizations
              </SidebarMenuLink>
              <SidebarMenuLink href={routes.dashboardBilling}>
                <CreditCard />
                Billing
              </SidebarMenuLink>
              <SidebarMenuLink href={routes.dashboardAiHelper}>
                <Sparkles />
                AI Helper
              </SidebarMenuLink>
              <SidebarMenuLink href={routes.dashboardSettings}>
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
