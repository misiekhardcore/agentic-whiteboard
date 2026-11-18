import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import { WORKSPACE_NOT_ARCHIVED_MESSAGE } from "./constants";

/** Deleting is permanent: archiving is the reversible step and the precondition. */
export function deleteRefusal(workspace: { archivedAt: Date | null }): CapabilityFailure | null {
  return workspace.archivedAt ? null : failure(WORKSPACE_NOT_ARCHIVED_MESSAGE);
}
