import { and, desc, eq, isNotNull, isNull, or, type SQL } from "drizzle-orm";

import type { WorkspacePermission } from "@/lib/collab/contracts";
import { db } from "@/lib/db";
import { member, workspaces } from "@/lib/db/schema";

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
 * Who is looking at a board and what their account lets them do. `role` is the
 * organization role for a shared board and `"owner"` for a personal one; it is
 * carried here so per-board RBAC can narrow {@link workspacePermission} without
 * changing any caller.
 */
export type WorkspaceAccess = {
  workspace: Workspace;
  kind: "personal" | "organization";
  organizationId: string | null;
  role: string;
};

/**
 * Which workspaces belong to the selected account: an organization's boards, or
 * the personal boards its owner created outside any organization. The dashboard
 * never mixes the two.
 */
function accountScopeWhere(userId: string, organizationId: string | null): SQL {
  if (organizationId) return eq(workspaces.orgId, organizationId);

  // `and` is typed as possibly-empty; with two conditions it always returns SQL.
  return and(eq(workspaces.creatorId, userId), isNull(workspaces.orgId))!;
}

/**
 * The boards that count against the account: everything it owns that has not
 * been archived. The list, the usage meter and the create-quota check all scope
 * by this predicate, so a board the dashboard shows is always a board the meter
 * counted, and archiving one frees its slot.
 */
export function accountWorkspacesWhere(
  userId: string,
  organizationId: string | null,
): SQL {
  return and(
    accountScopeWhere(userId, organizationId),
    isNull(workspaces.archivedAt),
  )!;
}

/**
 * The boards that belong to the selected account, newest first.
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
 * The archived boards of the selected account, most recently archived first.
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
    .where(
      and(
        accountScopeWhere(userId, organizationId),
        isNotNull(workspaces.archivedAt),
      ),
    )
    .orderBy(desc(workspaces.archivedAt));

  return rows.flatMap((row) =>
    row.archivedAt ? [{ ...row, archivedAt: row.archivedAt }] : [],
  );
}

/**
 * A single board together with the access the signed-in person has to it.
 *
 * Authorization comes from the board's own account, not from the account the
 * dashboard happens to be showing: a personal board is visible only to its
 * creator, and an organization board to that organization's members. Anything
 * else resolves to `null`, so callers cannot tell a missing board from a
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
    .leftJoin(
      member,
      and(
        eq(member.organizationId, workspaces.orgId),
        eq(member.userId, userId),
      ),
    )
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
 * What an accessible board permits. Every member of the board's account may
 * edit today, so this only distinguishes a reader from an editor once
 * per-workspace RBAC introduces read-only roles; keep the decision here so
 * actions and future collaboration tokens share it.
 */
export function workspacePermission(
  access: WorkspaceAccess,
): WorkspacePermission {
  return VIEW_ONLY_ROLES.includes(access.role) ? "view" : "edit";
}
