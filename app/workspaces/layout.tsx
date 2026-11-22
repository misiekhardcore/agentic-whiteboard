import { privateMetadata } from "@/app/metadata/privateMetadata";
import { AgentPanel } from "@/components/AgentPanel/AgentPanel";
import { DashboardShell } from "@/components/DashboardShell/DashboardShell";

export const metadata = privateMetadata;

export default function WorkspacesLayout({ children }: LayoutProps<"/workspaces">) {
  return (
    <DashboardShell>
      {/* Mounted by the section, not by a page: moving between the board and a
          workspace keeps the same live conversation on screen. */}
      <AgentPanel>{children}</AgentPanel>
    </DashboardShell>
  );
}
