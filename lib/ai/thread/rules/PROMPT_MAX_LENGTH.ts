/**
 * Rules for the dashboard's prompt thread. Pure, so the route, the persistence
 * adapter and the composer can share one definition of a sendable prompt, one
 * mapping between stored messages and AI SDK messages, and one answer to "is
 * this a new prompt or the answer to one the agent is waiting on?".
 */
export const PROMPT_MAX_LENGTH = 4000;
