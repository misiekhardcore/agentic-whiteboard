"use server";

import { type WorkspaceFormState } from "../forms";

import { formState, update } from "./internals";

export async function updateWorkspaceAction(
  _previousState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  return formState(await update(formData), (name) => `${name} updated.`);
}
