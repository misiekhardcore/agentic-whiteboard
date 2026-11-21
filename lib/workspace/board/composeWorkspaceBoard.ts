import { WORKSPACE_STATUSES } from "../status";

import type { BoardWorkspace, WorkspaceBoard } from "./types";

/**
 * The board as the page reads it: one column per stage, in the vocabulary's
 * order, holding the rows of that stage. A column with nothing in it is still
 * rendered, because an empty stage is information.
 *
 * A column is ordered by the workspace's manual position; the id breaks a tie
 * so two rows never swap places between reads when their positions match.
 */
export function composeWorkspaceBoard(workspaces: BoardWorkspace[]): WorkspaceBoard {
  return WORKSPACE_STATUSES.map((status) => ({
    status,
    workspaces: workspaces
      .filter((workspace) => workspace.status === status)
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id)),
  }));
}
