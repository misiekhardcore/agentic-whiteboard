/**
 * The membership rules, as pure functions: who may administer an organization
 * and which organization the session is acting as. Queries stay in `queries.ts`
 * so a role check never has to load a page of rows to answer a yes/no.
 */
/** Roles that may invite, remove and pay. */
export const TEAM_ADMIN_ROLES = ["owner", "admin"] as const;
