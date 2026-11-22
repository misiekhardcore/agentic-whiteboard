"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { WorkspaceCard } from "@/components/Workspaces/WorkspaceCard";
import type { BoardWorkspace } from "@/lib/workspace/board";
import type { WorkspaceStatus } from "@/lib/workspace/status";

/**
 * One card on the board. The card body is the drag activator, so it is picked up
 * from anywhere; its link and menu still work because the mouse sensor waits for
 * movement and touch waits for a press, and a plain click is neither.
 *
 * The attribute role stays a group rather than the sensor's default button: the
 * card contains a link and a menu, and a button may not wrap them.
 */
export function SortableWorkspaceCard({
  workspace,
  status,
}: {
  workspace: BoardWorkspace;
  status: WorkspaceStatus;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: workspace.id, data: { status } });

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        role="group"
        tabIndex={0}
        aria-pressed={undefined}
        aria-label={workspace.name}
        aria-roledescription="draggable workspace"
        className={`cursor-grab touch-manipulation rounded-lg transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        {/* The column already names the stage, so the card leaves it out. */}
        <WorkspaceCard workspace={{ ...workspace, archived: false }} showStage={false} as="div" />
      </div>
    </li>
  );
}
