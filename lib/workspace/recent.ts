import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { canvases, docs, workspaces } from "@/lib/db/schema";

import { accountWorkspacesWhere } from "./queries";

/**
 * The dashboard's latest-items list: workspaces, their documents and their
 * canvases in one list, newest first.
 *
 * This is the one read that spans surfaces. It joins the doc and canvas tables
 * because those tables hold no rule of their own yet; when the doc and canvas
 * contexts land with the collaboration gateway, each will expose its own recent
 * rows and this module will compose them instead of joining them.
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
  status: (typeof workspaces.$inferSelect)["status"];
  updatedAt: Date;
};

/**
 * Newest first, capped at `limit`. Sorting and the cap live here instead of in
 * SQL so the three queries can run in parallel and the dashboard and the
 * all-workspaces page share one ordering rule.
 */
export function mergeRecentItems(
  items: RecentWorkspaceItem[],
  limit: number,
): RecentWorkspaceItem[] {
  return [...items]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, limit));
}

/**
 * The account's latest workspaces, docs and canvases, newest first. Archived
 * workspaces are excluded by the same predicate the plan meter uses, so an
 * archived workspace's doc and canvas drop out of the list with it.
 */
export async function listRecentWorkspaceItems(
  userId: string,
  organizationId: string | null,
  limit = 5,
): Promise<RecentWorkspaceItem[]> {
  const scope = accountWorkspacesWhere(userId, organizationId);

  const [workspaceRows, docRows, canvasRows] = await Promise.all([
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        description: workspaces.description,
        status: workspaces.status,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaces)
      .where(scope),
    db
      .select({
        id: docs.id,
        updatedAt: docs.updatedAt,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        status: workspaces.status,
      })
      .from(docs)
      .innerJoin(workspaces, eq(docs.workspaceId, workspaces.id))
      .where(scope),
    db
      .select({
        id: canvases.id,
        updatedAt: canvases.updatedAt,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        status: workspaces.status,
      })
      .from(canvases)
      .innerJoin(workspaces, eq(canvases.workspaceId, workspaces.id))
      .where(scope),
  ]);

  const items: RecentWorkspaceItem[] = [
    ...workspaceRows.map((row) => ({
      key: `workspace:${row.id}`,
      type: "workspace" as const,
      id: row.id,
      workspaceId: row.id,
      workspaceName: row.name,
      description: row.description,
      status: row.status,
      updatedAt: row.updatedAt,
    })),
    ...docRows.map((row) => ({
      key: `doc:${row.id}`,
      type: "doc" as const,
      description: null,
      ...row,
    })),
    ...canvasRows.map((row) => ({
      key: `canvas:${row.id}`,
      type: "canvas" as const,
      description: null,
      ...row,
    })),
  ];

  return mergeRecentItems(items, limit);
}
