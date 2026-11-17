/**
 * The question the thread is waiting on.
 *
 * A gated tool parks its call until the person answers, and the answer travels
 * through the browser, so it is matched back to the stored request rather than
 * trusted: by the reference the SDK signed, inside the person's own thread, and
 * only while the request is still unanswered. A turn an edit discarded is not
 * answerable even if its card is still open in a stale tab.
 */
/** How long an unanswered approval stays answerable. */
export const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;
