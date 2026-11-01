import {
  DashboardSidebar,
} from "@/components/Sidebar/Sidebar";
import { SidebarProvider } from "@konopskidev/ui/components/sidebar";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <div className="w-full p-4">{children}</div>
    </SidebarProvider>
  );
}
