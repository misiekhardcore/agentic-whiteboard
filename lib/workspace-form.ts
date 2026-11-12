/**
 * State shared by the board forms that use `useActionState`. No server imports,
 * so the dialogs can read it and the server actions can return it.
 */
export type WorkspaceFieldErrors = {
  name?: string;
  description?: string;
  status?: string;
};

export type WorkspaceFormState = {
  error: string | null;
  notice?: string | null;
  fieldErrors?: WorkspaceFieldErrors;
  /** True when the account is out of workspace slots, so the form offers plans. */
  limitReached?: boolean;
  /** True once the mutation stored, so the dialog can close itself. */
  saved?: boolean;
};

export const EMPTY_WORKSPACE_FORM_STATE: WorkspaceFormState = {
  error: null,
  notice: null,
  fieldErrors: {},
  limitReached: false,
  saved: false,
};

/** Shared limits so the server and the dialogs agree on what is valid. */
export const WORKSPACE_NAME_MAX_LENGTH = 120;
export const WORKSPACE_DESCRIPTION_MAX_LENGTH = 500;
