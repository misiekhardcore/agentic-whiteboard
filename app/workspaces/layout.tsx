import { privateMetadata } from "@/app/metadata/privateMetadata";
import { DashboardShell } from "@/components/DashboardShell/DashboardShell";

export const metadata = privateMetadata;

export default function WorkspacesLayout({ children }: LayoutProps<"/workspaces">) {
  return <DashboardShell>{children}</DashboardShell>;
}
