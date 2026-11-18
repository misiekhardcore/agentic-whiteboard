import { and, eq, isNotNull } from "drizzle-orm";

import { failure } from "@/lib/capabilities/define";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import type { WorkspaceAccess } from "../access";
import type { WorkspaceMutationResult } from "../contracts";
import { abortRefusal, deleteRefusal, WORKSPACE_NOT_FOUND_MESSAGE } from "../rules";

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
