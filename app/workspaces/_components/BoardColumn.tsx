"use client";

import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { Badge } from "@konopskidev/ui/components/badge";

import type { WorkspaceBoardColumn } from "@/lib/workspace/board";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace/status";

import { SortableWorkspaceCard } from "./SortableWorkspaceCard";

/**
 * One stage column: a droppable so an empty column still accepts a card, and a
 * sortable context whose item order matches the order on screen. The outline
 * follows the column the dragged card is currently in, so it stays lit while the
 * pointer is over a card rather than the column's empty space.
 */
export function BoardColumn({
  column,
  isDropTarget = false,
}: {
  column: WorkspaceBoardColumn;
  isDropTarget?: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `stage:${column.status}`,
    data: { status: column.status },
  });
  const headingId = `stage-${column.status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`flex min-h-40 flex-col gap-3 rounded-lg border bg-muted/30 p-3 ${
        isDropTarget ? "border-primary/60" : "border-border"
      }`}
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
        <SortableContext
          items={column.workspaces.map((workspace) => workspace.id)}
          strategy={rectSortingStrategy}
        >
          <ul className="flex flex-col gap-3">
            {column.workspaces.map((workspace) => (
              <SortableWorkspaceCard
                key={workspace.id}
                workspace={workspace}
                status={column.status}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}
