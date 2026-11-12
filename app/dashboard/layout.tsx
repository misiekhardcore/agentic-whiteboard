import { SidebarProvider } from "@konopskidev/ui/components/sidebar";

import { DashboardSidebar } from "@/components/Sidebar/Sidebar";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    // The wrapper from the design system is `min-h-svh`, which is taller than
    // the room the shell leaves under the header; `min-h-0!` lets it take the
    // remaining height so the page below can scroll inside it instead of
    // pushing its last rows past the viewport.
    <SidebarProvider className="min-h-0! flex-1 overflow-hidden">
      <DashboardSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4">
        {children}
      </div>
    </SidebarProvider>
  );
}
