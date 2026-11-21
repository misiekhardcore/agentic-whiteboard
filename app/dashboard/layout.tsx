import { privateMetadata } from "@/app/metadata/privateMetadata";
import { DashboardShell } from "@/components/DashboardShell/DashboardShell";

// The dashboard itself has no page metadata, so the layout names the route
// instead of leaving the landing page's title in the tab.
export const metadata = { ...privateMetadata, title: "Dashboard" };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <DashboardShell>{children}</DashboardShell>;
}
