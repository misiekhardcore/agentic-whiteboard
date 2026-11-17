export type SessionAccount = {
  user: { id: string };
  session: { activeOrganizationId?: string | null };
};
