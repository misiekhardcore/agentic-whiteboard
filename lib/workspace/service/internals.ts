import { eq } from "drizzle-orm";

import { failure } from "@/lib/capabilities/define";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import type { WorkspaceAccess } from "../access";
import type { WorkspaceRequester } from "../activity";
import type { WorkspaceMutationResult } from "../contracts";
import { abortRefusal, WORKSPACE_NOT_FOUND_MESSAGE, workspaceActivityFor } from "../rules";

import { recordActivityWith } from "./recordActivityWith";

/**
 * Archive and restore are one write with one difference: the value of
 * `archivedAt`. Both record the activity in the same transaction, and a call
 * that finds the row already in the requested state records nothing, because
 * nothing happened.
 */
export async function setArchivedWith(
  access: WorkspaceAccess,
  requester: WorkspaceRequester,
  archivedAt: Date | null,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const stopped = abortRefusal(signal);
  if (stopped) return stopped;

  const archived = archivedAt !== null;
  const changed = archived !== (access.workspace.archivedAt !== null);

  return db.transaction(async (tx) => {
    const [updated] = await tx
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

    if (changed) {
      await recordActivityWith(
        tx,
        workspaceActivityFor(
          updated.id,
          [{ surface: "WORKSPACE", kind: archived ? "ARCHIVED" : "RESTORED", details: {} }],
          requester,
        ),
      );
    }

    return { ok: true, workspace: updated };
  });
}
