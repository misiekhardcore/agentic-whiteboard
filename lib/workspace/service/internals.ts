import { eq } from "drizzle-orm";

import { failure } from "@/lib/capabilities/define";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import type { WorkspaceAccess } from "../access";
import type { WorkspaceMutationResult } from "../contracts";
import { abortRefusal, WORKSPACE_NOT_FOUND_MESSAGE } from "../rules";

export async function setArchivedWith(
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
