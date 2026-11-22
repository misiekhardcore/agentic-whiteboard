import { AgentPanel } from "@/components/AgentPanel/AgentPanel";

export default function ArchiveLayout({ children }: LayoutProps<"/dashboard/archive">) {
  // The archive is a workspace surface like the board, so it gets the panel;
  // the dashboard itself keeps its inline composer instead.
  return <AgentPanel>{children}</AgentPanel>;
}
