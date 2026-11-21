import type { AccountWorkspace } from "../queries";
import type { WorkspaceStatus } from "../status";

export type { BoardWorkspace } from "../queries";

/** One stage of the board, always present even when nothing sits in it. */
export type WorkspaceBoardColumn = {
  status: WorkspaceStatus;
  workspaces: AccountWorkspace[];
};

export type WorkspaceBoard = WorkspaceBoardColumn[];
