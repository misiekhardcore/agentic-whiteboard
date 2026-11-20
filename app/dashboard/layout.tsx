import { privateMetadata } from "@/app/metadata/privateMetadata";
import { DashboardShell } from "@/components/DashboardShell/DashboardShell";

export const metadata = privateMetadata;

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <DashboardShell>{children}</DashboardShell>;
}
