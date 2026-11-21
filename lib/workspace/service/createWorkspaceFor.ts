import { count, sql } from "drizzle-orm";

import { getOrganizationEntitlements, getUserEntitlements } from "@/lib/billing/entitlements";
import { workspaceLimitMessage } from "@/lib/billing/usage";
import { failure } from "@/lib/capabilities/define";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import type { WorkspaceRequester } from "../activity";
import type { WorkspaceMutationResult } from "../contracts";
import { accountWorkspacesWhere } from "../queries";
import {
  abortRefusal,
  hasFieldErrors,
  normalizeWorkspaceDraft,
  workspaceActivityFor,
} from "../rules";

import { recordActivityWith } from "./recordActivityWith";

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
  requester: WorkspaceRequester,
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

  const entitlements = requester.organizationId
    ? await getOrganizationEntitlements(requester.organizationId)
    : await getUserEntitlements(requester.userId);

  const ownerKey = requester.organizationId ?? `personal:${requester.userId}`;

  return db.transaction(async (tx) => {
    // Serialize creates per account so the quota cannot be exceeded by two
    // requests that both counted the same used rows.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('workspace_create'), hashtext(${ownerKey}))`,
    );

    const [row] = await tx
      .select({ total: count() })
      .from(workspaces)
      .where(accountWorkspacesWhere(requester.userId, requester.organizationId));

    const message = workspaceLimitMessage({
      used: Number(row?.total ?? 0),
      limit: entitlements.limits.workspaces,
      plan: entitlements.plan.name,
      accountName: requester.accountName,
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
        creatorId: requester.userId,
        orgId: requester.organizationId,
      })
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        status: workspaces.status,
      });

    if (!created) {
      return failure("The workspace was not created.");
    }

    // In the same transaction as the insert: a workspace without its creation
    // activity is a history with a hole, and a failed log write must roll the
    // workspace back rather than leave it unrecorded.
    await recordActivityWith(
      tx,
      workspaceActivityFor(
        created.id,
        [{ surface: "WORKSPACE", kind: "CREATED", details: {} }],
        requester,
      ),
    );

    return { ok: true as const, workspace: created };
  });
}
