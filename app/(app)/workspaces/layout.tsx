import { AgentPanel } from "@/components/AgentPanel/AgentPanel";

export default function WorkspacesLayout({ children }: LayoutProps<"/workspaces">) {
  return (
    // Mounted by the section, not by a page: moving between the board, a
    // workspace, its history and the archive keeps the same live conversation
    // on screen, and the archive is a workspace surface, not a dashboard page.
    <AgentPanel>{children}</AgentPanel>
  );
}
