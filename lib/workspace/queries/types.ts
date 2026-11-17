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
