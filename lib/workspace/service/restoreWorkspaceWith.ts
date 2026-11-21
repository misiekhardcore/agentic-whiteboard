import type { WorkspaceAccess } from "../access";
import type { WorkspaceRequester } from "../activity";
import type { WorkspaceMutationResult } from "../contracts";

import { setArchivedWith } from "./internals";

/** Puts an archived workspace back on the dashboard and into the plan meter. */
export async function restoreWorkspaceWith(
  access: WorkspaceAccess,
  requester: WorkspaceRequester,
  options: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  return setArchivedWith(access, requester, null, options);
}
