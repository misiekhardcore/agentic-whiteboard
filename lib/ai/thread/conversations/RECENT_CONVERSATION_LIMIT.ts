/**
 * Reads for the dashboard's conversations: which thread is open, its stored
 * messages, and the recent list the switcher offers.
 *
 * A conversation is the person's, so every read is scoped by `userId` and never
 * by an id alone: the ids reach the browser, and an id from another account must
 * select nothing.
 */
/** How many past conversations the switcher offers. */
export const RECENT_CONVERSATION_LIMIT = 5;
