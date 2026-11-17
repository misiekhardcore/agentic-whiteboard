import type { WorkspaceFormState } from "./types";

export const EMPTY_WORKSPACE_FORM_STATE: WorkspaceFormState = {
  error: null,
  notice: null,
  fieldErrors: {},
  limitReached: false,
  saved: false,
};
