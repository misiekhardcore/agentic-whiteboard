"use server";

import { type WorkspaceFormState } from "../forms";

import { create, formState } from "./internals";

export async function createWorkspaceAction(
  _previousState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  return formState(await create(formData), (name) => `${name} created.`);
}
