/**
 * How many conversations the history dialog offers. It is a bound rather than a
 * page size: the dialog is a scroll box of labels, and asking for more than a
 * person will ever scroll through costs a query that reads the same either way.
 */
export const CONVERSATION_HISTORY_LIMIT = 200;

/** How long a conversation's label may be before it is cut. */
export const CONVERSATION_PREVIEW_LENGTH = 48;

/**
 * How long a generated title may be. A title is a name, not a summary, and the
 * roundest useful bound is one a pill can show without becoming a sentence.
 */
export const CONVERSATION_TITLE_MAX_LENGTH = 60;

/**
 * Rules for the dashboard's prompt thread. Pure, so the route, the persistence
 * adapter and the composer can share one definition of a sendable prompt, one
 * mapping between stored messages and AI SDK messages, and one answer to "is
 * this a new prompt or the answer to one the agent is waiting on?".
 */
export const PROMPT_MAX_LENGTH = 4000;
