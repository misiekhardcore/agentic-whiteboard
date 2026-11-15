import { APIError } from "better-auth/api";

/**
 * The sentences a person sees when Better Auth refuses an organization
 * operation. One map, because the invite form, the role form, the settings form
 * and checkout all surface the same codes.
 */
const MESSAGES: Record<string, string> = {
  ORGANIZATION_ALREADY_EXISTS: "An organization with that name already exists.",
  ORGANIZATION_NOT_FOUND: "That organization no longer exists.",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "That URL is already taken. Pick a different one.",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "That person is already a member.",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "That person already has a pending invitation.",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
    "Only organization owners and admins can invite people.",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: "You cannot remove that member.",
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: "You cannot cancel that invitation.",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION:
    "Only owners and admins can edit the organization profile.",
  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: "You are no longer a member of that organization.",
  MEMBER_NOT_FOUND: "That person is no longer a member.",
  INVITATION_NOT_FOUND: "That invitation no longer exists.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "That invitation was sent to a different email address.",
  INVITATION_EXPIRED: "That invitation has expired. Ask an organization admin for a new one.",
  MEMBERSHIP_LIMIT_REACHED: "This organization has reached its member limit.",
};

/**
 * Turns a Better Auth error into a sentence a person can act on. Codes we do
 * not know keep the caller's fallback, so internal details stay on the server.
 */
export function organizationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const code = error.body?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
    if (error.body?.message) return error.body.message;
  }

  return fallback;
}
