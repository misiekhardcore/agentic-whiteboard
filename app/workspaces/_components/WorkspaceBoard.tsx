import { Badge } from "@konopskidev/ui/components/badge";
import type { ReactNode } from "react";

import { WorkspaceCard } from "@/components/Workspaces/WorkspaceCard";
import type { WorkspaceBoard as WorkspaceBoardColumns } from "@/lib/workspace/board";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace/status";

/**
 * The board: one column per stage, in stage order. Every column renders even
 * when it holds nothing, because an empty stage is information, but no column
 * offers a create button of its own. An empty account still sees the frame; its
 * empty state reads above the columns instead of replacing them.
 */
export function WorkspaceBoard({
  board,
  emptyState,
}: {
  board: WorkspaceBoardColumns;
  emptyState?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {emptyState}

      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {board.map((column) => {
          const headingId = `stage-${column.status}`;
          return (
            <section
              key={column.status}
              aria-labelledby={headingId}
              className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h2
                  id={headingId}
                  className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase"
                >
                  {WORKSPACE_STATUS_LABELS[column.status]}
                </h2>
                <Badge variant="secondary">{column.workspaces.length}</Badge>
              </div>

              {column.workspaces.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nothing in this stage yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {column.workspaces.map((workspace) => (
                    <WorkspaceCard key={workspace.id} workspace={workspace} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
