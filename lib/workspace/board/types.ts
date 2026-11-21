import type { AccountWorkspace } from "../queries";
import type { WorkspaceStatus } from "../status";

/** A workspace on the board: the list row plus the value its column orders by. */
export type BoardWorkspace = AccountWorkspace & {
  position: number;
};

/** One stage of the board, always present even when nothing sits in it. */
export type WorkspaceBoardColumn = {
  status: WorkspaceStatus;
  workspaces: BoardWorkspace[];
};

export type WorkspaceBoard = WorkspaceBoardColumn[];
