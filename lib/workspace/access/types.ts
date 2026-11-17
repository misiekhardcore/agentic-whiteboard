import type { workspaces } from "@/lib/db/schema";

/**
 * Who may see or change a workspace, and the one read that answers it.
 *
 * Authorization comes from the workspace's own account, not from the account the
 * dashboard happens to be showing, so a stale active-account id cannot reach
 * another tenant's rows. A refused workspace resolves to `null`, which reports
 * as missing rather than forbidden: an answer never confirms that another
 * tenant's id exists.
 */
export type Workspace = typeof workspaces.$inferSelect;

/**
 * What the person may do with the row they can reach. `role` is the
 * organization role for a shared workspace and `"owner"` for a personal one; it
 * is carried here so per-workspace RBAC narrows {@link workspacePermission}
 * without changing a caller.
 */
export type WorkspaceAccess = {
  workspace: Workspace;
  kind: "personal" | "organization";
  organizationId: string | null;
  role: string;
};
