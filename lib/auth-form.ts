export type AuthFormState = {
  error: string | null;
  /** Values to repopulate after a failed submit. Never includes the password. */
  values?: {
    name?: string;
    email?: string;
  };
};

export const initialAuthState: AuthFormState = { error: null };
