import { and, desc, eq, isNotNull, isNull, or, type SQL } from "drizzle-orm";

import type { WorkspacePermission } from "@/lib/collab/contracts";
import { db } from "@/lib/db";
import { canvases, docs, member, workspaces } from "@/lib/db/schema";

export type Workspace = typeof workspaces.$inferSelect;

export type AccountWorkspace = {
  id: string;
  name: string;
  description: string | null;
  status: Workspace["status"];
  updatedAt: Date;
};

export type ArchivedWorkspace = {
  id: string;
  name: string;
  status: Workspace["status"];
  archivedAt: Date;
};

/**
 * One row of the dashboard's latest-items list. A workspace, its document and its
 * canvas are separate entries, so the list reads as "what changed recently"
 * rather than one card per workspace.
 */
export type RecentWorkspaceItem = {
  key: string;
  type: "workspace" | "doc" | "canvas";
  id: string;
  workspaceId: string;
  workspaceName: string;
  /** Only a workspace carries a description; its doc and canvas inherit the border. */
  description: string | null;
  status: Workspace["status"];
  updatedAt: Date;
};

/**
 * Who is looking at a workspace and what their account lets them do. `role` is the
 * organization role for a shared workspace and `"owner"` for a personal one; it is
 * carried here so per-workspace RBAC can narrow {@link workspacePermission} without
 * changing any caller.
 */
export type WorkspaceAccess = {
  workspace: Workspace;
  kind: "personal" | "organization";
  organizationId: string | null;
  role: string;
};

/**
 * Which workspaces belong to the selected account: an organization's workspaces, or
 * the personal workspaces its owner created outside any organization. The dashboard
 * never mixes the two.
 */
function accountScopeWhere(userId: string, organizationId: string | null): SQL {
  if (organizationId) return eq(workspaces.orgId, organizationId);

  // `and` is typed as possibly-empty; with two conditions it always returns SQL.
  return and(eq(workspaces.creatorId, userId), isNull(workspaces.orgId))!;
}

/**
 * The workspaces that count against the account: everything it owns that has not
 * been archived. The list, the usage meter and the create-quota check all scope
 * by this predicate, so a workspace the dashboard shows is always a workspace the meter
 * counted, and archiving one frees its slot.
 */
export function accountWorkspacesWhere(userId: string, organizationId: string | null): SQL {
  return and(accountScopeWhere(userId, organizationId), isNull(workspaces.archivedAt))!;
}

/**
 * The workspaces that belong to the selected account, newest first.
 */
export async function listAccountWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<AccountWorkspace[]> {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      status: workspaces.status,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(accountWorkspacesWhere(userId, organizationId))
    .orderBy(desc(workspaces.updatedAt));
}

/**
 * The archived workspaces of the selected account, most recently archived first.
 * These are hidden from the dashboard list and from the plan meter until they
 * are restored.
 */
export async function listArchivedWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<ArchivedWorkspace[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
      archivedAt: workspaces.archivedAt,
    })
    .from(workspaces)
    .where(and(accountScopeWhere(userId, organizationId), isNotNull(workspaces.archivedAt)))
    .orderBy(desc(workspaces.archivedAt));

  return rows.flatMap((row) => (row.archivedAt ? [{ ...row, archivedAt: row.archivedAt }] : []));
}

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
 * The account's latest workspaces, docs and canvases in one list, newest first.
 * Archived workspaces are excluded by the same predicate the plan meter uses, so an
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

/**
 * A single workspace together with the access the signed-in person has to it.
 *
 * Authorization comes from the workspace's own account, not from the account the
 * dashboard happens to be showing: a personal workspace is visible only to its
 * creator, and an organization workspace to that organization's members. Anything
 * else resolves to `null`, so callers cannot tell a missing workspace from a
 * forbidden one.
 */
export async function getWorkspaceForUser(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceAccess | null> {
  const [row] = await db
    .select({
      workspace: workspaces,
      memberRole: member.role,
    })
    .from(workspaces)
    .leftJoin(member, and(eq(member.organizationId, workspaces.orgId), eq(member.userId, userId)))
    .where(
      and(
        eq(workspaces.id, workspaceId),
        or(
          and(isNull(workspaces.orgId), eq(workspaces.creatorId, userId)),
          isNotNull(member.userId),
        ),
      ),
    )
    .limit(1);

  if (!row) return null;

  const organizationId = row.workspace.orgId;

  return {
    workspace: row.workspace,
    kind: organizationId ? "organization" : "personal",
    organizationId,
    role: organizationId ? (row.memberRole ?? "member") : "owner",
  };
}

const VIEW_ONLY_ROLES: readonly string[] = [];

/**
 * What an accessible workspace permits. Every member of the workspace's account may
 * edit today, so this only distinguishes a reader from an editor once
 * per-workspace RBAC introduces read-only roles; keep the decision here so
 * actions and future collaboration tokens share it.
 */
export function workspacePermission(access: WorkspaceAccess): WorkspacePermission {
  return VIEW_ONLY_ROLES.includes(access.role) ? "view" : "edit";
}
