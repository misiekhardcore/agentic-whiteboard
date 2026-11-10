/** State shared by the personal and organization profile forms. */
export type ProfileFormState = {
  error: string | null;
  notice?: string | null;
};

export const EMPTY_PROFILE_FORM_STATE: ProfileFormState = {
  error: null,
  notice: null,
};
