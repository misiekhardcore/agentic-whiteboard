import type { ArchivedWorkspace } from "@/lib/workspace/queries";

import { WorkspaceCard } from "./WorkspaceCard";

/**
 * Archived workspaces as the grid the archive and the dashboard's archived
 * section share. The read row already carries the state's fields, so the grid
 * only says which state a card is in; it owns no markup of its own.
 */
export function ArchivedWorkspaceGrid({ workspaces }: { workspaces: ArchivedWorkspace[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {workspaces.map((workspace) => (
        <WorkspaceCard key={workspace.id} workspace={{ ...workspace, archived: true }} />
      ))}
    </ul>
  );
}
