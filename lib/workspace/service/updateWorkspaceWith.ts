import { eq } from "drizzle-orm";

import { failure } from "@/lib/capabilities/define";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import type { WorkspaceAccess } from "../access";
import type { WorkspaceMutationResult, WorkspaceUpdateInput } from "../contracts";
import { abortRefusal, mergeWorkspaceUpdate, WORKSPACE_NOT_FOUND_MESSAGE } from "../rules";

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
