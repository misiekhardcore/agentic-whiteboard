import type { WorkspaceAccess } from "../access";
import type { WorkspaceMutationResult } from "../contracts";

import { setArchivedWith } from "./internals";

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
