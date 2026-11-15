/** State shared by the sign-in, sign-up and reset forms. */
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

/** State shared by the personal and organization profile forms. */
export type ProfileFormState = {
  error: string | null;
  notice?: string | null;
};

export const EMPTY_PROFILE_FORM_STATE: ProfileFormState = {
  error: null,
  notice: null,
};
