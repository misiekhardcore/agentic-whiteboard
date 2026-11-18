import {
  WORKSPACE_DESCRIPTION_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
  type WorkspaceFieldErrors,
} from "../forms";

import type { WorkspaceDraft } from "./types";

/**
 * Trims what the user (or the agent) typed and reports the field errors once.
 */
export function normalizeWorkspaceDraft({
  name,
  description,
}: {
  name: string;
  description: string;
}): { draft: WorkspaceDraft; fieldErrors: WorkspaceFieldErrors } {
  const draft: WorkspaceDraft = {
    name: name.trim(),
    description: description.trim() || null,
  };

  const fieldErrors: WorkspaceFieldErrors = {};
  if (!draft.name) {
    fieldErrors.name = "Name your workspace.";
  } else if (draft.name.length > WORKSPACE_NAME_MAX_LENGTH) {
    fieldErrors.name = `Keep the name under ${WORKSPACE_NAME_MAX_LENGTH} characters.`;
  }
  if (draft.description && draft.description.length > WORKSPACE_DESCRIPTION_MAX_LENGTH) {
    fieldErrors.description = `Keep the description under ${WORKSPACE_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  return { draft, fieldErrors };
}
