import { type AccountWorkspace } from "../queries";

/**
 * The dashboard's latest-items list: workspaces, their documents and their
 * canvases in one list, newest first.
 *
 * This read model composes the workspace's own surface read instead of joining
 * tables itself: the surfaces answer for their rows, the workspace rows carry
 * the account scope, and a surface whose workspace is not in the list is gone.
 */
/** One row of the dashboard's latest-items list. */
export type RecentWorkspaceItem = {
  key: string;
  type: "workspace" | "doc" | "canvas";
  id: string;
  workspaceId: string;
  workspaceName: string;
  /** Only a workspace carries a description; its doc and canvas inherit the border. */
  description: string | null;
  status: AccountWorkspace["status"];
  updatedAt: Date;
};
