/** How long a conversation's title may be before it is cut. */
export const CONVERSATION_TITLE_MAX_LENGTH = 60;

/** What an empty conversation is called, on the row and in the switcher. */
export const EMPTY_CONVERSATION_TITLE = "New conversation";

/**
 * Marks a title request on the wire. The scripted model fixture answers titles
 * from the same chat-completions endpoint as the agent and recognises this
 * literal, so it must stay in step with `scripts/scripted-model/policy.mjs`.
 */
export const TITLE_REQUEST_MARKER = "[[conversation-title]]";

/** How much of a prompt the title request is given. */
export const TITLE_SOURCE_MAX_LENGTH = 2000;
