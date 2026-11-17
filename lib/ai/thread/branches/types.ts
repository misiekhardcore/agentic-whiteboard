/**
 * Branching a conversation.
 *
 * A branch is a new conversation that begins with a copy of another one's live
 * turns through a chosen reply, so a person can carry the thread somewhere else
 * without losing the one it came from.
 *
 * The copy is history, not work. Every copied prompt records the prompt it came
 * from (`branchedFromId`) and is skipped by the monthly count, because the turn
 * already ran — and was already paid for — in the conversation it belongs to.
 * Copying rather than sharing is what keeps "a prompt belongs to one
 * conversation" true: editing a copied turn rewinds the branch, never the
 * original.
 *
 * The copy keeps the source order exactly, by giving each row a later timestamp
 * than the one before it. A branch is read as one continuous past thread, and
 * the ids are freshly generated, so relying on either `createdAt` alone or on an
 * id tie-break would shuffle turns that the source stored in the same
 * millisecond.
 */
export type BranchResult =
  | { kind: "branched"; conversationId: string }
  /** The reply is not a live turn of this person's conversation. */
  | { kind: "missing" }
  /** The turn has not finished, so there is no settled history to copy. */
  | { kind: "unfinished" };
