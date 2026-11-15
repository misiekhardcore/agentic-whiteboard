import { and, count, eq, isNotNull, sql } from "drizzle-orm";

import { getOrganizationEntitlements, getUserEntitlements } from "@/lib/billing/entitlements";
import { workspaceLimitMessage } from "@/lib/billing/usage";
import { failure } from "@/lib/capabilities/define";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import type { AccountActor } from "@/lib/identity/actor";

import type { WorkspaceAccess } from "./access";
import type { WorkspaceMutationResult, WorkspaceUpdateInput } from "./contracts";
import { accountWorkspacesWhere } from "./queries";
import {
  abortRefusal,
  deleteRefusal,
  hasFieldErrors,
  mergeWorkspaceUpdate,
  normalizeWorkspaceDraft,
  WORKSPACE_NOT_FOUND_MESSAGE,
} from "./rules";

/**
 * The workspace writes, shared by the human dialog and the agent's tools.
 *
 * Every function here takes the actor from the caller — never from a request
 * body, a form field or the model — and returns the kernel's failure shape, so
 * a refusal needs no translation on its way to a form or to the model. The
 * rules themselves live in `rules.ts`; this module applies them and owns the
 * quota, the lock and the write.
 */

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
  actor: AccountActor,
  input: { name: string; description?: string | null },
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const { draft, fieldErrors } = normalizeWorkspaceDraft({
    name: input.name,
    description: input.description ?? "",
  });
  if (hasFieldErrors(fieldErrors)) {
    return failure("Check the workspace details.", { fieldErrors });
  }

  const stopped = abortRefusal(signal);
  if (stopped) return stopped;

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

    if (message) return failure(message, { limitReached: true });

    // No await between this check and the insert: either the stop is visible
    // now, or the write happens as one short statement.
    const lateStop = abortRefusal(signal);
    if (lateStop) return lateStop;

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
      return failure("The workspace was not created.");
    }

    return { ok: true as const, workspace: created };
  });
}

/**
 * Renames a workspace, changes its description or moves it between stages. The
 * caller has already authorized the row, so the access check and the write do
 * not read the same row twice.
 */
export async function updateWorkspaceWith(
  access: WorkspaceAccess,
  input: WorkspaceUpdateInput,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const merged = mergeWorkspaceUpdate(
    {
      name: access.workspace.name,
      description: access.workspace.description,
      status: access.workspace.status,
    },
    input,
  );
  if (!merged.ok) return merged;

  const stopped = abortRefusal(signal);
  if (stopped) return stopped;

  const [updated] = await db
    .update(workspaces)
    .set(merged.values)
    .where(eq(workspaces.id, access.workspace.id))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
    });

  if (!updated) {
    return failure(WORKSPACE_NOT_FOUND_MESSAGE);
  }

  return { ok: true, workspace: updated };
}

/**
 * Soft delete: the workspace is hidden and stops counting against the plan.
 * Its stage, documents, canvas and agent history stay for a restore.
 */
export async function archiveWorkspaceWith(
  access: WorkspaceAccess,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  return setArchivedWith(access, new Date(), options);
}

/** Puts an archived workspace back on the dashboard and into the plan meter. */
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
export async function deleteWorkspaceWith(
  access: WorkspaceAccess,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const refusal = deleteRefusal(access.workspace);
  if (refusal) return refusal;

  const stopped = abortRefusal(signal);
  if (stopped) return stopped;

  const [deleted] = await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, access.workspace.id), isNotNull(workspaces.archivedAt)))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
    });

  if (!deleted) {
    return failure(WORKSPACE_NOT_FOUND_MESSAGE);
  }

  return { ok: true, workspace: deleted };
}

async function setArchivedWith(
  access: WorkspaceAccess,
  archivedAt: Date | null,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const stopped = abortRefusal(signal);
  if (stopped) return stopped;

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
    return failure(WORKSPACE_NOT_FOUND_MESSAGE);
  }

  return { ok: true, workspace: updated };
}
