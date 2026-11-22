"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { WorkspaceCard } from "@/components/Workspaces/WorkspaceCard";
import { moveWorkspaceAction } from "@/lib/workspace/actions";
import type { WorkspaceBoard as WorkspaceBoardColumns } from "@/lib/workspace/board";
import {
  isWorkspaceStatus,
  WORKSPACE_STATUS_LABELS,
  type WorkspaceStatus,
} from "@/lib/workspace/status";

import { applyBoardMove, placementOf } from "./applyBoardMove";
import { BoardColumn } from "./BoardColumn";

type DragNode = { data: { current?: Record<string, unknown> } } | null;

function statusOfNode(node: DragNode): WorkspaceStatus | null {
  const status = node?.data.current?.status;
  return isWorkspaceStatus(status) ? status : null;
}

/**
 * Whether the dragged card has travelled past the middle of the card it is over,
 * which decides whether it lands after that card's centre rather than before it.
 */
function releasedPastCard(
  active: DragEndEvent["active"],
  over: NonNullable<DragEndEvent["over"]>,
): boolean {
  const dragged = active.rect.current.translated;
  if (!dragged) return false;

  return dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2;
}

/**
 * The board as a person uses it. The whole card is the drag activator, and a
 * floating copy follows the pointer while the card's place moves with it: as it
 * crosses into another column the preview is inserted there, so a drop never
 * happens where the card cannot be seen.
 *
 * A drop names the target stage and the two cards around the new place; the
 * server derives the position. The card is placed optimistically, and a refusal
 * puts the board back where it was with the reason read out by the toast.
 *
 * Pointer, touch and keyboard all use the same activator, and the custom
 * announcements name the card and its column so a screen reader hears the move.
 */
export function WorkspaceBoard({
  board,
  emptyState,
}: {
  board: WorkspaceBoardColumns;
  emptyState?: ReactNode;
}) {
  const [rendered, setRendered] = useState({ source: board, columns: board });
  const [activeId, setActiveId] = useState<string | null>(null);
  const draggedFrom = useRef<WorkspaceBoardColumns | null>(null);
  const [, startTransition] = useTransition();

  // A server render after the move is the authority; a new `board` replaces the
  // optimistic copy instead of leaving two versions to drift apart. Adjusting
  // state during render is React's pattern for derived-from-props state.
  if (rendered.source !== board) setRendered({ source: board, columns: board });
  const columns = rendered.source === board ? rendered.columns : board;
  const setColumns = (next: WorkspaceBoardColumns) =>
    setRendered((current) => ({ ...current, columns: next }));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const workspaceName = (id: string) =>
    columns.flatMap((column) => column.workspaces).find((workspace) => workspace.id === id)?.name ??
    "A workspace";

  const stageName = (status: WorkspaceStatus | null) =>
    status ? WORKSPACE_STATUS_LABELS[status] : "another column";

  const activeCard = activeId
    ? columns.flatMap((column) => column.workspaces).find((workspace) => workspace.id === activeId)
    : undefined;
  const activeStatus = activeId ? placementOf(columns, activeId)?.status : undefined;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    draggedFrom.current = columns;
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;

    const activeWorkspaceId = String(active.id);
    if (String(over.id) === activeWorkspaceId) return;

    const targetStatus = statusOfNode(over) ?? statusOfNode(active);
    if (targetStatus === null) return;

    // Inside one column the sortable strategy opens the gap itself, and moving
    // the array under it would fight that animation; only a crossing column is
    // previewed here, exactly as the multi-container guide describes.
    if (placementOf(columns, activeWorkspaceId)?.status === targetStatus) return;

    const move = applyBoardMove({
      columns,
      activeId: activeWorkspaceId,
      targetStatus,
      overId: String(over.id),
      insertAfter: releasedPastCard(active, over),
    });
    if (move) setColumns(move.columns);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const movedFrom = draggedFrom.current;
    setActiveId(null);
    draggedFrom.current = null;
    if (!over || !movedFrom) return;

    const activeWorkspaceId = String(active.id);
    const targetStatus = statusOfNode(over) ?? statusOfNode(active);
    if (targetStatus === null) {
      setColumns(movedFrom);
      return;
    }

    // The drop may settle the order the preview could not: a card released on a
    // card inside one column takes that card's place.
    const settled = applyBoardMove({
      columns,
      activeId: activeWorkspaceId,
      targetStatus,
      overId: String(over.id),
      insertAfter: releasedPastCard(active, over),
    });
    const next = settled?.columns ?? columns;
    const landing = placementOf(next, activeWorkspaceId);
    const startedAt = placementOf(movedFrom, activeWorkspaceId);
    if (!landing) return;

    // A drop that changed nothing is not a write, and any preview jitter is put
    // back rather than sent to the server.
    if (
      startedAt?.status === landing.status &&
      startedAt.previousId === landing.previousId &&
      startedAt.nextId === landing.nextId
    ) {
      setColumns(movedFrom);
      return;
    }

    setColumns(next);

    startTransition(async () => {
      const result = await moveWorkspaceAction({
        workspaceId: activeWorkspaceId,
        status: landing.status,
        previousId: landing.previousId,
        nextId: landing.nextId,
      });

      if (!result.ok) {
        // Only undo this drop's optimistic board; a later drag may already have
        // replaced it, and reverting then would discard that newer intent.
        setRendered((current) =>
          current.columns === next ? { ...current, columns: movedFrom } : current,
        );
        toast.error(result.error);
      }
    });
  }

  function handleDragCancel() {
    const movedFrom = draggedFrom.current;
    draggedFrom.current = null;
    setActiveId(null);
    if (movedFrom) setColumns(movedFrom);
  }

  return (
    <div className="flex flex-col gap-3">
      {emptyState}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        // The preview inserts a card into another column mid-drag, which moves
        // every rect in both columns; measuring only before the drag would place
        // the drop on stale geometry.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "To move a workspace, press space or enter to pick it up, use the arrow keys to choose a column and place, then press space or enter again to drop it. Press escape to cancel.",
          },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${workspaceName(String(active.id))}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `${workspaceName(String(active.id))} is over ${stageName(statusOfNode(over))}.`
                : `${workspaceName(String(active.id))} is not over a column.`,
            onDragEnd: ({ active, over }) =>
              over
                ? `Moved ${workspaceName(String(active.id))} to ${stageName(statusOfNode(over))}.`
                : `Move cancelled. ${workspaceName(String(active.id))} stayed where it was.`,
            onDragCancel: ({ active }) =>
              `Move cancelled. ${workspaceName(String(active.id))} stayed where it was.`,
          },
        }}
      >
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => (
            <BoardColumn
              key={column.status}
              column={column}
              isDropTarget={activeStatus === column.status}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div aria-hidden className="h-full w-full cursor-grabbing">
              <WorkspaceCard
                workspace={{ ...activeCard, archived: false }}
                showStage={false}
                as="div"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
