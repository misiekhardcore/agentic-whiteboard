/**
 * A conversation id reaches the route from the browser, so it is checked for
 * shape before it is used in a query. Random UUIDs (a new thread) and the
 * migration's `legacy-<userId>` ids both pass; the id only ever selects data the
 * session's own user owns.
 */
export function conversationIdProblem(id: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(id)
    ? null
    : "Send the conversation this prompt belongs to.";
}
