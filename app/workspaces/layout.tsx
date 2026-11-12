import { DashboardShell } from "@/components/DashboardShell/DashboardShell";

export default function WorkspacesLayout({
  children,
}: LayoutProps<"/workspaces">) {
  return <DashboardShell>{children}</DashboardShell>;
}
