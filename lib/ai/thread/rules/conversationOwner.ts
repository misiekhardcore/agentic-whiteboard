import type { ConversationOwner } from "./types";

/**
 * Who a conversation belongs to: the signed-in person in the account they are
 * acting as. Every read and write takes this instead of a bare user id, so the
 * account cannot be left behind by a caller.
 *
 * The account kind is recorded, not inferred: an organization is not "whatever
 * is not personal", and a personal conversation carries the person's own id in
 * the same position an organization's id occupies. A row can say which account
 * it belongs to without asking the session what is active now.
 */
export function conversationOwner({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string | null;
}): ConversationOwner {
  if (organizationId) return { userId, accountType: "ORGANIZATION", accountId: organizationId };

  return { userId, accountType: "PERSONAL", accountId: userId };
}
