import { SidebarProvider } from "@konopskidev/ui/components/sidebar";
import { Suspense } from "react";

import {
  DashboardSidebar,
} from "@/components/Sidebar/Sidebar";
import { WorkspaceUsage } from "@/components/Sidebar/WorkspaceUsage";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <SidebarProvider>
      <DashboardSidebar
        footer={
          <Suspense fallback={null}>
            <WorkspaceUsage />
          </Suspense>
        }
      />
      <div className="w-full p-4">{children}</div>
    </SidebarProvider>
  );
}
