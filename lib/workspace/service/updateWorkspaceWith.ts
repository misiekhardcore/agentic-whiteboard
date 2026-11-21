import { eq } from "drizzle-orm";

import { failure } from "@/lib/capabilities/define";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import type { WorkspaceAccess } from "../access";
import type { WorkspaceRequester } from "../activity";
import type { WorkspaceMutationResult, WorkspaceUpdateInput } from "../contracts";
import {
  abortRefusal,
  activityChangesForUpdate,
  mergeWorkspaceUpdate,
  WORKSPACE_NOT_FOUND_MESSAGE,
  workspaceActivityFor,
} from "../rules";

import { recordActivityWith } from "./recordActivityWith";

/**
 * Renames a workspace, changes its description or moves it between stages. The
 * caller has already authorized the row, so the access check and the write do
 * not read the same row twice.
 *
 * The stage/number update and the activity it records share a transaction: a
 * human action and an agent capability therefore leave identical history, and
 * a change with no recorded activity cannot commit.
 */
export async function updateWorkspaceWith(
  access: WorkspaceAccess,
  requester: WorkspaceRequester,
  input: WorkspaceUpdateInput,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const current = {
    name: access.workspace.name,
    description: access.workspace.description,
    status: access.workspace.status,
  };

  const merged = mergeWorkspaceUpdate(current, input);
  if (!merged.ok) return merged;

  const stopped = abortRefusal(signal);
  if (stopped) return stopped;

  const changes = activityChangesForUpdate(current, merged.values);

  return db.transaction(async (tx) => {
    const [updated] = await tx
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

    await recordActivityWith(tx, workspaceActivityFor(updated.id, changes, requester));

    return { ok: true, workspace: updated };
  });
}
