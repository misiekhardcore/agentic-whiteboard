import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import { WORKSPACE_NOT_ARCHIVED_MESSAGE } from "./WORKSPACE_NOT_ARCHIVED_MESSAGE";

/** Deleting is permanent: archiving is the reversible step and the precondition. */
export function deleteRefusal(workspace: { archivedAt: Date | null }): CapabilityFailure | null {
  return workspace.archivedAt ? null : failure(WORKSPACE_NOT_ARCHIVED_MESSAGE);
}
