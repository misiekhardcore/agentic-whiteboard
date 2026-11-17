/**
 * State shared by the workspace forms that use `useActionState`. No server imports,
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
