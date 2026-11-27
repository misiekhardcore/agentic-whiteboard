import { auth } from "./auth";
import { authErrorMessage } from "./authErrorMessage";
import { identityStore } from "./identityStore";
import { invitationRefusal } from "./invitationRefusal";
import type { InvitationForDecision, SessionActor } from "./types";

/** What the accept page names before anyone decides. */
export type InvitationView = {
  id: string;
  email: string;
  role: string;
  status: string;
  expired: boolean;
  organizationName: string;
  inviterName: string;
};

export type InvitationResult = { ok: true } | { ok: false; error: string };

export async function loadInvitation(id: string, now = new Date()): Promise<InvitationView | null> {
  const invitation = await identityStore().findInvitation(id);
  if (invitation === null) return null;

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role ?? "member",
    status: invitation.status,
    expired: invitation.expiresAt.getTime() <= now.getTime(),
    organizationName: invitation.organizationName,
    inviterName: invitation.inviterName,
  };
}

/**
 * Accepting an invitation is the invited person's own act. The rule is decided
 * from the invitation row and the session's verified address; better-auth then
 * writes the member with the invited role and marks the invitation accepted, so
 * a replay finds no pending invitation and is refused without a write.
 */
export async function acceptInvitation({
  invitationId,
  session,
  headers,
  now = new Date(),
}: {
  invitationId: string;
  session: SessionActor;
  headers: Headers;
  now?: Date;
}): Promise<InvitationResult> {
  const invitation = await identityStore().findInvitation(invitationId);
  if (invitation === null) {
    return { ok: false, error: "That invitation could not be found." };
  }

  const refusal = invitationRefusal(
    invitation satisfies InvitationForDecision,
    session.person,
    now,
  );
  if (refusal !== null) return { ok: false, error: refusal };

  try {
    await auth.api.acceptInvitation({ body: { invitationId }, headers });
  } catch (error) {
    console.error(
      "[identity] invitation acceptance failed:",
      error instanceof Error ? error.message : error,
    );
    const body: unknown =
      typeof error === "object" && error !== null && "body" in error ? error.body : undefined;
    const code =
      typeof body === "object" && body !== null && "code" in body && typeof body.code === "string"
        ? body.code
        : undefined;
    return {
      ok: false,
      error: authErrorMessage(code, "Could not accept the invitation. Try again."),
    };
  }

  return { ok: true };
}
