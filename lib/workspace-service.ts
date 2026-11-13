import { count, eq, sql } from "drizzle-orm";

import {
  getOrganizationEntitlements,
  getUserEntitlements,
} from "@/lib/billing/entitlements";
import { workspaceLimitMessage } from "@/lib/billing/usage";
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

export type WorkspaceActor = {
  userId: string;
  /** The active account: an organization id, or `null` for the personal one. */
  organizationId: string | null;
  /** Readable account name, used in quota copy. */
  accountName: string;
};

export type WorkspaceDraft = {
  name: string;
  description: string | null;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  status: WorkspaceStatus;
};

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
 * Returned when the caller stopped its request before the workspace was
 * written. An aborted prompt must not leave a workspace behind, so the write is
 * skipped rather than committed for nobody.
 */
export const WORKSPACE_ABORTED_MESSAGE =
  "The request was stopped before the workspace was created.";

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
  if (
    draft.description &&
    draft.description.length > WORKSPACE_DESCRIPTION_MAX_LENGTH
  ) {
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

  const aborted = (): WorkspaceMutationResult => ({
    ok: false,
    error: WORKSPACE_ABORTED_MESSAGE,
  });

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
 * Renames a workspace and moves it between stages. Authorization is resolved
 * from the workspace's own account, so a stale active-account id cannot reach
 * another tenant's rows.
 */
export async function updateWorkspaceFor(
  actor: WorkspaceActor,
  input: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
  },
): Promise<WorkspaceMutationResult> {
  if (!input.id) {
    return { ok: false, error: "That workspace could not be found." };
  }

  const access = await getWorkspaceForUser(input.id, actor.userId);
  if (!access || workspacePermission(access) !== "edit") return forbidden();

  const { draft, fieldErrors } = normalizeWorkspaceDraft({
    name: input.name,
    description: input.description ?? "",
  });
  if (hasFieldErrors(fieldErrors)) {
    return { ok: false, error: "Check the workspace details.", fieldErrors };
  }
  if (!isWorkspaceStatus(input.status)) {
    return {
      ok: false,
      error: "Choose a stage for the workspace.",
      fieldErrors: { status: "Choose a stage for the workspace." },
    };
  }

  const [updated] = await db
    .update(workspaces)
    .set({
      name: draft.name,
      description: draft.description,
      status: input.status,
    })
    .where(eq(workspaces.id, input.id))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
    });

  if (!updated) {
    return { ok: false, error: "That workspace could not be found." };
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
): Promise<WorkspaceMutationResult> {
  return setArchived(actor, workspaceId, new Date());
}

/** Puts an archived workspace back on the dashboard and into the plan meter. */
export async function restoreWorkspaceFor(
  actor: WorkspaceActor,
  workspaceId: string,
): Promise<WorkspaceMutationResult> {
  return setArchived(actor, workspaceId, null);
}

async function setArchived(
  actor: WorkspaceActor,
  workspaceId: string,
  archivedAt: Date | null,
): Promise<WorkspaceMutationResult> {
  if (!workspaceId) {
    return { ok: false, error: "That workspace could not be found." };
  }

  const access = await getWorkspaceForUser(workspaceId, actor.userId);
  if (!access || workspacePermission(access) !== "edit") return forbidden();

  const [updated] = await db
    .update(workspaces)
    .set({ archivedAt })
    .where(eq(workspaces.id, workspaceId))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
    });

  if (!updated) {
    return { ok: false, error: "That workspace could not be found." };
  }

  return { ok: true, workspace: updated };
}
