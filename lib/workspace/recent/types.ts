import { type AccountWorkspace, type WorkspaceCreator } from "../queries";

/** A workspace row with the timestamp its card shows. */
export type RecentWorkspaceRow = AccountWorkspace & { lastActivity: Date };

/** What every latest-list entry carries: a workspace or one surface of it. */
type RecentItemBase = {
  key: string;
  id: string;
  workspaceId: string;
  workspaceName: string;
  description: string | null;
  status: AccountWorkspace["status"];
  updatedAt: Date;
};

/** A workspace's own entry: it has the creator and activity its card shows. */
export type RecentWorkspaceEntry = RecentItemBase & {
  type: "workspace";
  creator: WorkspaceCreator | null;
  lastActivity: Date;
};

/** A doc or canvas: it borrows its workspace's name and stage, and nothing else. */
export type RecentSurfaceEntry = RecentItemBase & {
  type: "doc" | "canvas";
};

/**
 * The dashboard's latest-items list: workspaces, their documents and their
 * canvases in one list, newest first.
 *
 * This read model composes the workspace's own surface read instead of joining
 * tables itself: the surfaces answer for their rows, the workspace rows carry
 * the account scope, and a surface whose workspace is not in the list is gone.
 */
export type RecentWorkspaceItem = RecentWorkspaceEntry | RecentSurfaceEntry;
