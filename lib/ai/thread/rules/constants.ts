/**
 * How many conversations the history dialog offers. It is a bound rather than a
 * page size: the dialog is a scroll box of labels, and asking for more than a
 * person will ever scroll through costs a query that reads the same either way.
 */
export const CONVERSATION_HISTORY_LIMIT = 200;

/** How long a conversation's label may be before it is cut. */

/**
 * Rules for the dashboard's prompt thread. Pure, so the route, the persistence
 * adapter and the composer can share one definition of a sendable prompt, one
 * mapping between stored messages and AI SDK messages, and one answer to "is
 * this a new prompt or the answer to one the agent is waiting on?".
 */
export const PROMPT_MAX_LENGTH = 4000;
