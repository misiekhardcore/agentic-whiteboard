export /**
 * The prompts nothing is working on.
 *
 * A prompt row is a lease on the person's thread, and the stream that owns it
 * lives in the process that opened it: a restart mid-reply leaves the row
 * QUEUED or RUNNING forever. No timestamp can tell that row from a healthy slow
 * model, so the process's own registry of what it is streaming is the only
 * authority — anything active it is not streaming was left by a server that has
 * since gone.
 *
 * Retiring it as FAILED is what keeps a restart from blocking the thread, and
 * what makes it retryable for free once it is.
 */
/**
 * The error a retired prompt carries, so the person is told what happened
 * instead of finding a reply that stops mid-sentence.
 */
const ORPHANED_PROMPT_ERROR =
  "The agent stopped before finishing this prompt. Send it again to retry.";
