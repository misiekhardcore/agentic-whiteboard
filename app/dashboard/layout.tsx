import { DashboardShell } from "@/components/DashboardShell/DashboardShell";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <DashboardShell>{children}</DashboardShell>;
}
