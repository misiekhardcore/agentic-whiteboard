export type AuthFormState = {
  error: string | null;
  /** A non-error confirmation, e.g. "we sent you a link". */
  notice?: string | null;
  /** Values to repopulate after a failed submit. Never includes the password. */
  values?: {
    name?: string;
    email?: string;
  };
};

export const initialAuthState: AuthFormState = { error: null };
