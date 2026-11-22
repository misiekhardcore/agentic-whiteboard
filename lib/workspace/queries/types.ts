import type { workspaces } from "@/lib/db/schema";

/**
 * The workspace's reads. Everything that decides what a caller may see is in
 * `access.ts`; this module only answers questions about rows that are already
 * in scope, and never writes.
 */
export type AccountWorkspace = {
  id: string;
  name: string;
  description: string | null;
  status: (typeof workspaces.$inferSelect)["status"];
  updatedAt: Date;
};

export type ArchivedWorkspace = {
  id: string;
  name: string;
  description: string | null;
  status: (typeof workspaces.$inferSelect)["status"];
  archivedAt: Date;
};

/** Who created a workspace, as a card shows them. Missing when the row is gone. */
export type WorkspaceCreator = {
  name: string;
  image: string | null;
};

/** A workspace as the board's row read returns it: position, creator, creation. */
export type BoardWorkspaceRow = AccountWorkspace & {
  position: number;
  creator: WorkspaceCreator | null;
  createdAt: Date;
};

/** A board card: the row read plus the workspace's newest activity. */
export type BoardWorkspace = BoardWorkspaceRow & {
  lastActivity: Date;
};
