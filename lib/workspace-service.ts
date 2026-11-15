import { and, count, eq, isNotNull, sql } from "drizzle-orm";

import type { AccountActor } from "@/lib/actor";
import { getOrganizationEntitlements, getUserEntitlements } from "@/lib/billing/entitlements";
import { workspaceLimitMessage } from "@/lib/billing/usage";
import type { WorkspacePermission } from "@/lib/collab/contracts";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import {
  WORKSPACE_DESCRIPTION_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
  type WorkspaceFieldErrors,
} from "@/lib/workspace-form";
import { isWorkspaceStatus, type WorkspaceStatus } from "@/lib/workspace-status";
import {
  accountWorkspacesWhere,
  getWorkspaceForUser,
  listAccountWorkspaces,
  listArchivedWorkspaces,
  type WorkspaceAccess,
  workspacePermission,
} from "@/lib/workspaces";

/**
 * The workspace operations, shared by the human UI and the agent's tools.
 *
 * Authorization, the plan quota and the validation live here so the two callers
 * cannot drift: a server action only authenticates and revalidates, and a tool
 * only passes the actor it was built with. The actor's account is never taken
 * from a request body or from the model.
 */

export type WorkspaceActor = AccountActor;

/** What a caller sends to change some of a workspace's fields. */
export type WorkspaceUpdateInput = {
  id: string;
  name?: string;
  description?: string | null;
  status?: string;
};

const NOT_FOUND_MESSAGE = "That workspace could not be found.";

export type WorkspaceDraft = {
  name: string;
  description: string | null;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  status: WorkspaceStatus;
};

/** A workspace in a list: enough to identify it, nothing document-shaped. */
export type WorkspaceOverview = {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  archived: boolean;
};

/** One workspace as the detail view (and the agent) reads it. */
export type WorkspaceDetail = {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  archivedAt: Date | null;
};

export type WorkspaceReadResult =
  { ok: true; workspace: WorkspaceDetail } | { ok: false; error: string };

export type WorkspaceMutationResult =
  | { ok: true; workspace: WorkspaceSummary }
  | {
      ok: false;
      /** A sentence the form or the model can show as-is. */
      error: string;
      fieldErrors?: WorkspaceFieldErrors;
      /** True when the account is out of workspace slots. */
      limitReached?: boolean;
    };

/**
 * Returned when the caller stopped its request before the write. An aborted
 * prompt must not leave a change behind, so the write is skipped rather than
 * committed for nobody.
 */
export const WORKSPACE_ABORTED_MESSAGE = "The request was stopped before the change was made.";

/**
 * Deleting is permanent, so a workspace has to be archived first: the archive
 * step is the confirmation that the person wants it gone from their list, and
 * the only state in which a hard delete is allowed.
 */
export const WORKSPACE_NOT_ARCHIVED_MESSAGE = "Archive a workspace before deleting it permanently.";

/**
 * Trims what the user (or the agent) typed and reports the field errors once,
 * so the dialog and the tool reject the same drafts for the same reasons.
 */
export function normalizeWorkspaceDraft({
  name,
  description,
}: {
  name: string;
  description: string;
}): { draft: WorkspaceDraft; fieldErrors: WorkspaceFieldErrors } {
  const draft: WorkspaceDraft = {
    name: name.trim(),
    description: description.trim() || null,
  };

  const fieldErrors: WorkspaceFieldErrors = {};
  if (!draft.name) {
    fieldErrors.name = "Name your workspace.";
  } else if (draft.name.length > WORKSPACE_NAME_MAX_LENGTH) {
    fieldErrors.name = `Keep the name under ${WORKSPACE_NAME_MAX_LENGTH} characters.`;
  }
  if (draft.description && draft.description.length > WORKSPACE_DESCRIPTION_MAX_LENGTH) {
    fieldErrors.description = `Keep the description under ${WORKSPACE_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  return { draft, fieldErrors };
}

function hasFieldErrors(fieldErrors: WorkspaceFieldErrors): boolean {
  return Object.keys(fieldErrors).length > 0;
}

function forbidden(message = "You cannot edit that workspace."): WorkspaceMutationResult {
  return { ok: false, error: message };
}

function aborted(): WorkspaceMutationResult {
  return { ok: false, error: WORKSPACE_ABORTED_MESSAGE };
}

/**
 * The access check every operation goes through. Authorization comes from the
 * workspace's own account, so a stale active-account id cannot reach another
 * tenant's rows; a read and a write ask for different permissions here rather
 * than each re-deriving the rule.
 */
export async function authorizeWorkspace(
  actor: WorkspaceActor,
  workspaceId: string,
  permission: WorkspacePermission,
): Promise<WorkspaceAccess | null> {
  if (!workspaceId) return null;

  const access = await getWorkspaceForUser(workspaceId, actor.userId);
  if (!access) return null;

  return permission === "edit" && workspacePermission(access) !== "edit" ? null : access;
}

/**
 * The account's workspaces, newest first. Archived ones are opt-in: they are
 * hidden from the dashboard and the plan meter, so a caller that wants them
 * says so.
 */
export async function listWorkspacesFor(
  actor: WorkspaceActor,
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

/**
 * One workspace for someone who can see it. A workspace in another account is
 * reported as missing, not forbidden, so the answer does not confirm it exists.
 */
export async function readWorkspaceFor(
  actor: WorkspaceActor,
  workspaceId: string,
): Promise<WorkspaceReadResult> {
  const access = await authorizeWorkspace(actor, workspaceId, "view");
  if (!access) return { ok: false, error: NOT_FOUND_MESSAGE };

  return readWorkspaceWith(access);
}

/** The same read for a caller that has already loaded and authorized the row. */
export function readWorkspaceWith(access: WorkspaceAccess): WorkspaceReadResult {
  const { workspace } = access;

  return {
    ok: true,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      status: workspace.status,
      archivedAt: workspace.archivedAt,
    },
  };
}

/**
 * Creates a workspace in the actor's active account. The count and the insert
 * share a transaction with an advisory lock on the account, so two requests
 * cannot both take the last slot on a capped plan.
 *
 * `signal` is the caller's abort signal. It is checked before any work and again
 * just before the insert, which is the last await before the write, so a Stop
 * that lands during the quota count cannot create a workspace the person will
 * never see.
 */
export async function createWorkspaceFor(
  actor: WorkspaceActor,
  input: { name: string; description?: string | null },
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const { draft, fieldErrors } = normalizeWorkspaceDraft({
    name: input.name,
    description: input.description ?? "",
  });
  if (hasFieldErrors(fieldErrors)) {
    return { ok: false, error: "Check the workspace details.", fieldErrors };
  }

  if (signal?.aborted) return aborted();

  const entitlements = actor.organizationId
    ? await getOrganizationEntitlements(actor.organizationId)
    : await getUserEntitlements(actor.userId);

  const ownerKey = actor.organizationId ?? `personal:${actor.userId}`;

  return db.transaction(async (tx) => {
    // Serialize creates per account so the quota cannot be exceeded by two
    // requests that both counted the same used rows.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('workspace_create'), hashtext(${ownerKey}))`,
    );

    const [row] = await tx
      .select({ total: count() })
      .from(workspaces)
      .where(accountWorkspacesWhere(actor.userId, actor.organizationId));

    const message = workspaceLimitMessage({
      used: Number(row?.total ?? 0),
      limit: entitlements.limits.workspaces,
      plan: entitlements.plan.name,
      accountName: actor.accountName,
    });

    if (message) return { ok: false as const, error: message, limitReached: true };

    // No await between this check and the insert: either the stop is visible
    // now, or the write happens as one short statement.
    if (signal?.aborted) return aborted();

    const [created] = await tx
      .insert(workspaces)
      .values({
        name: draft.name,
        description: draft.description,
        creatorId: actor.userId,
        orgId: actor.organizationId,
      })
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        status: workspaces.status,
      });

    if (!created) {
      return { ok: false as const, error: "The workspace was not created." };
    }

    return { ok: true as const, workspace: created };
  });
}

/**
 * Renames a workspace, changes its description or moves it between stages.
 * Every field is optional; a caller sends only what changes and the current row
 * supplies the rest, so a rename cannot silently drop a description. The merged
 * values are validated once, exactly like a full edit form.
 */
export async function updateWorkspaceFor(
  actor: WorkspaceActor,
  input: WorkspaceUpdateInput,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  if (!input.id) {
    return { ok: false, error: NOT_FOUND_MESSAGE };
  }

  const access = await authorizeWorkspace(actor, input.id, "edit");
  if (!access) return forbidden();

  return updateWorkspaceWith(access, input, options);
}

/**
 * The update for a caller that already authorized the row, so the access check
 * and the write do not read the same row twice.
 */
export async function updateWorkspaceWith(
  access: WorkspaceAccess,
  input: WorkspaceUpdateInput,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const { draft, fieldErrors } = normalizeWorkspaceDraft({
    name: input.name ?? access.workspace.name,
    description:
      input.description === undefined
        ? (access.workspace.description ?? "")
        : (input.description ?? ""),
  });
  if (hasFieldErrors(fieldErrors)) {
    return { ok: false, error: "Check the workspace details.", fieldErrors };
  }

  const status = input.status ?? access.workspace.status;
  if (!isWorkspaceStatus(status)) {
    return {
      ok: false,
      error: "Choose a stage for the workspace.",
      fieldErrors: { status: "Choose a stage for the workspace." },
    };
  }

  if (signal?.aborted) return aborted();

  const [updated] = await db
    .update(workspaces)
    .set({
      name: draft.name,
      description: draft.description,
      status,
    })
    .where(eq(workspaces.id, access.workspace.id))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
    });

  if (!updated) {
    return { ok: false, error: NOT_FOUND_MESSAGE };
  }

  return { ok: true, workspace: updated };
}

/**
 * Soft delete: the workspace is hidden and stops counting against the plan.
 * Its stage, documents, canvas and agent history stay for a restore.
 */
export async function archiveWorkspaceFor(
  actor: WorkspaceActor,
  workspaceId: string,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const access = await authorizeWorkspace(actor, workspaceId, "edit");
  if (!access) return forbidden();

  return archiveWorkspaceWith(access, options);
}

/** Archives a workspace the caller already authorized. */
export async function archiveWorkspaceWith(
  access: WorkspaceAccess,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  return setArchivedWith(access, new Date(), options);
}

/** Puts an archived workspace back on the dashboard and into the plan meter. */
export async function restoreWorkspaceFor(
  actor: WorkspaceActor,
  workspaceId: string,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const access = await authorizeWorkspace(actor, workspaceId, "edit");
  if (!access) return forbidden();

  return restoreWorkspaceWith(access, options);
}

/** Restores a workspace the caller already authorized. */
export async function restoreWorkspaceWith(
  access: WorkspaceAccess,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  return setArchivedWith(access, null, options);
}

/**
 * Removes an archived workspace for good, with its documents, canvas and agent
 * history (the foreign keys cascade). Only an archived workspace may be deleted:
 * archiving is the reversible step and the confirmation, so a single request
 * cannot erase something that is still on the dashboard.
 *
 * The archived condition is repeated in the delete statement, so a restore that
 * lands between the check and the write makes the delete match nothing instead
 * of removing an active workspace.
 */
export async function deleteWorkspaceFor(
  actor: WorkspaceActor,
  workspaceId: string,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  if (!workspaceId) {
    return { ok: false, error: NOT_FOUND_MESSAGE };
  }

  const access = await authorizeWorkspace(actor, workspaceId, "edit");
  if (!access) return forbidden();

  return deleteWorkspaceWith(access, options);
}

/** Deletes an archived workspace the caller already authorized. */
export async function deleteWorkspaceWith(
  access: WorkspaceAccess,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  if (!access.workspace.archivedAt) {
    return { ok: false, error: WORKSPACE_NOT_ARCHIVED_MESSAGE };
  }

  if (signal?.aborted) return aborted();

  const [deleted] = await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, access.workspace.id), isNotNull(workspaces.archivedAt)))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
    });

  if (!deleted) {
    return { ok: false, error: NOT_FOUND_MESSAGE };
  }

  return { ok: true, workspace: deleted };
}

async function setArchivedWith(
  access: WorkspaceAccess,
  archivedAt: Date | null,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  if (signal?.aborted) return aborted();

  const [updated] = await db
    .update(workspaces)
    .set({ archivedAt })
    .where(eq(workspaces.id, access.workspace.id))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
    });

  if (!updated) {
    return { ok: false, error: NOT_FOUND_MESSAGE };
  }

  return { ok: true, workspace: updated };
}
