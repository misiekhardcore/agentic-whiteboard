import { SidebarProvider } from "@konopskidev/ui/components/sidebar";
import type { ReactNode } from "react";

import { DashboardSidebar } from "@/components/Sidebar/Sidebar";

/**
 * The sidebar shell shared by every signed-in workspace surface. The wrapper from
 * the design system is `min-h-svh`, which is taller than the room the shell
 * leaves under the header; `min-h-0!` lets it take the remaining height so the
 * page inside can scroll instead of pushing rows past the viewport.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider className="min-h-0! flex-1 overflow-hidden">
      <DashboardSidebar />
      {/* The shell owns the page's one main landmark; a page inside it is a
          section, so it must not render another. */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </SidebarProvider>
  );
}
