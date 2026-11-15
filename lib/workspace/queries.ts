import { and, count, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import type { AccountActor } from "@/lib/identity/actor";

import type { WorkspaceAccess } from "./access";
import type { WorkspaceDetail, WorkspaceOverview, WorkspaceReadResult } from "./contracts";

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

/**
 * Which workspaces belong to the selected account: an organization's workspaces,
 * or the personal workspaces its owner created outside any organization. The
 * dashboard never mixes the two.
 */
function accountScopeWhere(userId: string, organizationId: string | null): SQL {
  if (organizationId) return eq(workspaces.orgId, organizationId);

  // `and` is typed as possibly-empty; with two conditions it always returns SQL.
  return and(eq(workspaces.creatorId, userId), isNull(workspaces.orgId))!;
}

/**
 * The workspaces that count against the account: everything it owns that has
 * not been archived. The list, the usage meter and the create-quota check all
 * scope by this predicate, so a workspace the dashboard shows is always a
 * workspace the meter counted, and archiving one frees its slot.
 */
export function accountWorkspacesWhere(userId: string, organizationId: string | null): SQL {
  return and(accountScopeWhere(userId, organizationId), isNull(workspaces.archivedAt))!;
}

/** The workspaces that belong to the selected account, newest first. */
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
 * The archived workspaces of the selected account, most recently archived
 * first. These are hidden from the dashboard list and from the plan meter until
 * they are restored.
 */
export async function listArchivedWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<ArchivedWorkspace[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      status: workspaces.status,
      archivedAt: workspaces.archivedAt,
    })
    .from(workspaces)
    .where(and(accountScopeWhere(userId, organizationId), isNotNull(workspaces.archivedAt)))
    .orderBy(desc(workspaces.archivedAt));

  return rows.flatMap((row) => (row.archivedAt ? [{ ...row, archivedAt: row.archivedAt }] : []));
}

/** How many workspaces the account currently counts against its plan. */
export async function countAccountWorkspaces(
  userId: string,
  organizationId: string | null,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(workspaces)
    .where(accountWorkspacesWhere(userId, organizationId));

  return Number(row?.total ?? 0);
}

/**
 * The account's workspaces, newest first. Archived ones are opt-in: they are
 * hidden from the dashboard and the plan meter, so a caller that wants them
 * says so.
 */
export async function listWorkspacesFor(
  actor: Pick<AccountActor, "userId" | "organizationId">,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<WorkspaceOverview[]> {
  const [active, archived] = await Promise.all([
    listAccountWorkspaces(actor.userId, actor.organizationId),
    includeArchived
      ? listArchivedWorkspaces(actor.userId, actor.organizationId)
      : Promise.resolve([]),
  ]);

  return [
    ...active.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      status: workspace.status,
      archived: false,
    })),
    ...archived.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      status: workspace.status,
      archived: true,
    })),
  ];
}

/** The same read for a caller that has already loaded and authorized the row. */
export function readWorkspaceWith(access: WorkspaceAccess): WorkspaceReadResult {
  const { workspace } = access;

  const detail: WorkspaceDetail = {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    status: workspace.status,
    archivedAt: workspace.archivedAt,
  };

  return { ok: true, workspace: detail };
}
