import { listBoardWorkspaces, listNewestActivityByWorkspace } from "../queries";

import { composeWorkspaceBoard } from "./composeWorkspaceBoard";
import type { WorkspaceBoard } from "./types";

/**
 * The active account's board: its non-archived workspaces read once, their
 * newest activity aggregated in one more statement, then grouped into the four
 * stage columns the page renders. A workspace with no recorded activity still
 * has a value - the creation time its own row proves.
 */
export async function listWorkspaceBoard(
  userId: string,
  organizationId: string | null,
): Promise<WorkspaceBoard> {
  const workspaces = await listBoardWorkspaces(userId, organizationId);
  const newestActivity = await listNewestActivityByWorkspace(
    workspaces.map((workspace) => workspace.id),
  );

  return composeWorkspaceBoard(
    workspaces.map((workspace) => ({
      ...workspace,
      lastActivity: newestActivity.get(workspace.id) ?? workspace.createdAt,
    })),
  );
}
