import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import {
  WORKSPACE_DESCRIPTION_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
  type WorkspaceFieldErrors,
} from "./forms";
import { isWorkspaceStatus, type WorkspaceStatus } from "./status";

/**
 * The workspace's invariants, as pure functions.
 *
 * Nothing here reads a row or a clock: the service and the capabilities pass
 * values in and get a decision back, so the dialog and the tool reject the same
 * drafts for the same reasons and the rules are testable without a database.
 */

export const WORKSPACE_ABORTED_MESSAGE = "The request was stopped before the change was made.";
export const WORKSPACE_NOT_FOUND_MESSAGE = "That workspace could not be found.";
export const WORKSPACE_NOT_ARCHIVED_MESSAGE = "Archive a workspace before deleting it permanently.";
export const WORKSPACE_FORBIDDEN_MESSAGE = "You cannot edit that workspace.";

const DRAFT_PROBLEM = "Check the workspace details.";
const STAGE_PROBLEM = "Choose a stage for the workspace.";

export type WorkspaceDraft = {
  name: string;
  description: string | null;
};

export type WorkspaceValues = {
  name: string;
  description: string | null;
  status: WorkspaceStatus;
};

export type WorkspaceMerge = { ok: true; values: WorkspaceValues } | CapabilityFailure;

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

export function hasFieldErrors(fieldErrors: WorkspaceFieldErrors): boolean {
  return Object.keys(fieldErrors).length > 0;
}

/**
 * Merges a partial update onto the current row and validates the result once.
 * Every field is optional: a rename must not blank the description, and an
 * empty description is how a caller clears one.
 */
export function mergeWorkspaceUpdate(
  current: WorkspaceValues,
  input: { name?: string; description?: string | null; status?: string },
): WorkspaceMerge {
  const { draft, fieldErrors } = normalizeWorkspaceDraft({
    name: input.name ?? current.name,
    description:
      input.description === undefined ? (current.description ?? "") : (input.description ?? ""),
  });

  if (hasFieldErrors(fieldErrors)) {
    return failure(DRAFT_PROBLEM, { fieldErrors });
  }

  const status = input.status ?? current.status;
  if (!isWorkspaceStatus(status)) {
    return failure(STAGE_PROBLEM, { fieldErrors: { status: STAGE_PROBLEM } });
  }

  return {
    ok: true,
    values: { name: draft.name, description: draft.description, status },
  };
}

/** Deleting is permanent: archiving is the reversible step and the precondition. */
export function deleteRefusal(workspace: { archivedAt: Date | null }): CapabilityFailure | null {
  return workspace.archivedAt ? null : failure(WORKSPACE_NOT_ARCHIVED_MESSAGE);
}

/**
 * A stopped request must not leave a change behind. Checked before any work and
 * again just before the write, which is the last await before it.
 */
export function abortRefusal(signal?: AbortSignal): CapabilityFailure | null {
  return signal?.aborted ? failure(WORKSPACE_ABORTED_MESSAGE) : null;
}
