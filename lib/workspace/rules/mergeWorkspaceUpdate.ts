import { failure } from "@/lib/capabilities/define";

import { isWorkspaceStatus } from "../status";

import { hasFieldErrors } from "./hasFieldErrors";
import { DRAFT_PROBLEM, STAGE_PROBLEM } from "./internals";
import { normalizeWorkspaceDraft } from "./normalizeWorkspaceDraft";
import type { WorkspaceMerge, WorkspaceValues } from "./types";

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
