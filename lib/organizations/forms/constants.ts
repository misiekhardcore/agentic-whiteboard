export const EMPTY_TEAM_FORM_STATE: TeamFormState = {
  error: null,
  notice: null,
};

/** State shared by the team forms that use `useActionState`. */
export type TeamFormState = {
  error: string | null;
  notice?: string | null;
};
