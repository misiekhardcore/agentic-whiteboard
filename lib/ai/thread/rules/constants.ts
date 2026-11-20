/**
 * How many conversations the history dialog offers. It is a bound rather than a
 * page size: the dialog is a scroll box of labels, and asking for more than a
 * person will ever scroll through costs a query that reads the same either way.
 */
export const CONVERSATION_HISTORY_LIMIT = 200;

/** How long a prompt may be before it is refused. */
export const PROMPT_MAX_LENGTH = 4000;
