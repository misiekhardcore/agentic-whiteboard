import { arrayMove } from "@dnd-kit/sortable";

import type { BoardWorkspace, WorkspaceBoard } from "@/lib/workspace/board";
import type { WorkspaceStatus } from "@/lib/workspace/status";

export type BoardMove = {
  columns: WorkspaceBoard;
  /** The card above the new place, or absent at the top of the column. */
  previousId?: string;
  /** The card below the new place, or absent at the bottom of the column. */
  nextId?: string;
};

export type BoardPlacement = {
  status: WorkspaceStatus;
  previousId?: string;
  nextId?: string;
};

function neighboursOf(workspaces: BoardWorkspace[], index: number) {
  return {
    previousId: workspaces[index - 1]?.id,
    nextId: workspaces[index + 1]?.id,
  };
}

function replaceColumn(
  columns: WorkspaceBoard,
  status: WorkspaceStatus,
  workspaces: BoardWorkspace[],
): WorkspaceBoard {
  return columns.map((column) => (column.status === status ? { ...column, workspaces } : column));
}

/**
 * Where a card sits: its column and its two neighbours. Comparing a drop's
 * placement with the drag's starting placement tells a settled board from one
 * that never moved.
 */
export function placementOf(columns: WorkspaceBoard, workspaceId: string): BoardPlacement | null {
  for (const column of columns) {
    const index = column.workspaces.findIndex((workspace) => workspace.id === workspaceId);
    if (index === -1) continue;

    return { status: column.status, ...neighboursOf(column.workspaces, index) };
  }

  return null;
}

/**
 * The board after a drop, and the two neighbours the server derives a position
 * from. The browser only reorders its copy and names neighbours; it never picks
 * a number.
 *
 * Inside a column this follows `arrayMove`: the card takes the place of the card
 * it was dropped on, whether it travels up or down. Across columns the card is
 * inserted at the hovered card's index, after it when the pointer is past that
 * card's middle, so the dragged card is visible where it will land. A drop on
 * the column itself appends, so an empty column accepts a card.
 */
export function applyBoardMove({
  columns,
  activeId,
  targetStatus,
  overId,
  insertAfter = false,
}: {
  columns: WorkspaceBoard;
  activeId: string;
  targetStatus: WorkspaceStatus;
  overId: string;
  insertAfter?: boolean;
}): BoardMove | null {
  const source = columns.find((column) =>
    column.workspaces.some((workspace) => workspace.id === activeId),
  );
  const target = columns.find((column) => column.status === targetStatus);
  const moving = source?.workspaces.find((workspace) => workspace.id === activeId);
  if (!source || !target || !moving) return null;

  const overColumn = overId === `stage:${targetStatus}`;

  if (source.status === target.status) {
    const activeIndex = source.workspaces.findIndex((workspace) => workspace.id === activeId);
    const overIndex = overColumn
      ? source.workspaces.length - 1
      : source.workspaces.findIndex((workspace) => workspace.id === overId);
    if (overIndex === -1 || overIndex === activeIndex) return null;

    const reordered = arrayMove(source.workspaces, activeIndex, overIndex);
    return {
      columns: replaceColumn(columns, target.status, reordered),
      ...neighboursOf(reordered, overIndex),
    };
  }

  const overIndex = overColumn
    ? target.workspaces.length
    : target.workspaces.findIndex((workspace) => workspace.id === overId);
  const anchor = overIndex === -1 ? target.workspaces.length : overIndex;
  const insertAt = insertAfter && anchor < target.workspaces.length ? anchor + 1 : anchor;

  const placed = [
    ...target.workspaces.slice(0, insertAt),
    { ...moving, status: target.status },
    ...target.workspaces.slice(insertAt),
  ];

  return {
    columns: columns.map((column) => {
      if (column.status === target.status) return { ...column, workspaces: placed };
      if (column.status === source.status)
        return {
          ...column,
          workspaces: column.workspaces.filter((workspace) => workspace.id !== activeId),
        };
      return column;
    }),
    ...neighboursOf(placed, insertAt),
  };
}
