import { action } from "@/lib/capabilities/action";
import type { CapabilityOutput } from "@/lib/capabilities/define";

import {
  archiveWorkspace,
  createWorkspace,
  deleteWorkspace,
  restoreWorkspace,
  updateWorkspace,
} from "../capabilities";
import { EMPTY_WORKSPACE_FORM_STATE, type WorkspaceFormState } from "../forms";

export /**
 * Server actions are the human entry point: a typed wrapper around one
 * capability. Authentication, validation, authorization, the quota and the
 * revalidation paths all live behind `action()`, so nothing is re-derived here
 * and the agent's tools enforce exactly the same rules.
 *
 * The wrappers return `void` where a form calls them, because that is React's
 * form-action contract; the capability module itself is never marked
 * `"use server"`, so its handlers are not endpoints.
 */
const create = action(createWorkspace);

export const update = action(updateWorkspace);

export const archive = action(archiveWorkspace);

export const restore = action(restoreWorkspace);

export const remove = action(deleteWorkspace);

export /**
 * The form state a dialog reads. A field message already says what to fix, so
 * the summary alert stays empty; quota and permission refusals have no field
 * and keep their sentence.
 */
function formState(
  output: CapabilityOutput<{ workspace: { name: string } }>,
  notice: (name: string) => string,
): WorkspaceFormState {
  if (!output.ok) {
    const fieldErrors = {
      name: output.fieldErrors?.name,
      description: output.fieldErrors?.description,
      status: output.fieldErrors?.status,
    };

    return {
      ...EMPTY_WORKSPACE_FORM_STATE,
      error: Object.values(fieldErrors).some(Boolean) ? null : output.error,
      fieldErrors,
      limitReached: output.limitReached ?? false,
    };
  }

  return {
    ...EMPTY_WORKSPACE_FORM_STATE,
    notice: notice(output.workspace.name),
    saved: true,
  };
}
