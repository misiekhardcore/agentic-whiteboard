import { listBoardWorkspaces } from "../queries";

import { composeWorkspaceBoard } from "./composeWorkspaceBoard";
import type { WorkspaceBoard } from "./types";

/**
 * The active account's board: its non-archived workspaces read once, then
 * grouped into the four stage columns the page renders.
 */
export async function listWorkspaceBoard(
  userId: string,
  organizationId: string | null,
): Promise<WorkspaceBoard> {
  return composeWorkspaceBoard(await listBoardWorkspaces(userId, organizationId));
}
