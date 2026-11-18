import { type AccountWorkspace } from "../queries";

/**
 * The dashboard's latest-items list: workspaces, their documents and their
 * canvases in one list, newest first.
 *
 * This read model composes the surface contexts instead of joining their tables.
 * Each surface context answers for its own rows, and the workspace context keeps
 * the one decision they both depend on — which workspaces the account may see —
 * so archiving a workspace still drops its doc and canvas from the list without
 * either context knowing what an account is.
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
