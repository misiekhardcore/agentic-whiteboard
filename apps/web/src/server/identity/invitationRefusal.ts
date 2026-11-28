import type { InvitationForDecision } from "./types";

/**
 * Whether this person may accept this invitation now, as a sentence to show or
 * `null` for yes.
 *
 * The address decides: an invitation belongs to the person it names, not to
 * whoever holds the link. A spent invitation is refused before the expiry check
 * so a second click says "no longer pending" rather than pretending the link
 * belonged to someone new.
 */
export function invitationRefusal(
  invitation: InvitationForDecision,
  person: { email: string },
  now: Date,
): string | null {
  if (invitation.status !== "pending") {
    return "This invitation is no longer pending.";
  }

  if (invitation.expiresAt.getTime() <= now.getTime()) {
    return "This invitation has expired. Ask a team admin to send a new one.";
  }

  if (invitation.email.toLowerCase() !== person.email.toLowerCase()) {
    return `This invitation is for ${invitation.email}. Sign in with the invited address to accept.`;
  }

  return null;
}
