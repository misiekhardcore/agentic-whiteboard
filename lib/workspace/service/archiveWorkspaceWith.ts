import type { WorkspaceAccess } from "../access";
import type { WorkspaceRequester } from "../activity";
import type { WorkspaceMutationResult } from "../contracts";

import { setArchivedWith } from "./internals";

/**
 * Soft delete: the workspace is hidden and stops counting against the plan.
 * Its stage, documents, canvas and agent history stay for a restore.
 */
export async function archiveWorkspaceWith(
  access: WorkspaceAccess,
  requester: WorkspaceRequester,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  return setArchivedWith(access, requester, new Date(), options);
}
