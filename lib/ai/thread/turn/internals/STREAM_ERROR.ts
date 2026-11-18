export /**
 * One dashboard prompt turn: what the client must not decide — who is asking,
 * which account pays, whether the allowance has room, and how the prompt is
 * recorded — plus the stream that answers it.
 *
 * A POST is one of three things: a new prompt appended to a conversation, a
 * rewind that replaces an earlier turn (the person edited the prompt), or a
 * retry of the newest prompt that failed, which reuses its row so the person is
 * not charged twice. The fourth, answering a parked approval, is not a prompt at
 * all: it continues the row that is waiting.
 *
 * The body is only a submission: the prompt being sent, or the answer to the
 * parked approval. What the model is shown comes from the stored turns, so a
 * body that carries a discarded branch or invented history is answered exactly
 * like a clean one.
 *
 * The route above this owns only the session and the request body; everything
 * that reads the conversation lives here, which is what keeps the endpoint thin
 * and lets a second surface (a workspace conversation) reuse the same turn.
 */
const STREAM_ERROR = "The agent could not finish that prompt. Try again in a moment.";
