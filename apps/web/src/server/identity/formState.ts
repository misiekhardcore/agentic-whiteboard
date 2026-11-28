/**
 * One error slot per form: the same shape for a wrong password, a spent token
 * and a rate limit, so no page can answer more than it should.
 */
export type AuthFormState = {
  error: string | null;
  notice?: string | null;
  values?: {
    email?: string;
    name?: string;
  };
};

export const EMPTY_AUTH_FORM_STATE: AuthFormState = { error: null };
