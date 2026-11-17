export /**
 * The prompt row's life. A prompt is created when a send is accepted, runs as a
 * status on that row, and is closed with the status its stream ended in; a retry
 * and an answered approval reopen the same row, because the person already paid
 * for it.
 *
 * Everything that opens or reopens a row goes through the single-flight rule —
 * one QUEUED/RUNNING prompt per person's dashboard thread, enforced by a partial
 * unique index — so each of those paths says which way it lost rather than
 * throwing: `busy` when another stream holds the slot, `expired` when the row is
 * no longer the one to reuse. A row nothing has streamed since a restart is
 * retired first, so a dead prompt cannot hold the slot against the person.
 *
 * A prompt belongs to a conversation, and an edit does not delete the turns it
 * replaces: they are marked superseded, which keeps the allowance count and the
 * audit trail while taking them out of the thread.
 */
const UNIQUE_VIOLATION = "23505";

export /**
 * Whether the driver refused a write on a unique index. Drizzle wraps every
 * failed query in a `DrizzleQueryError` and keeps the driver's error as `cause`,
 * so the SQLSTATE is one level down — reading only the wrapper made a busy thread
 * surface as a 500 instead of the 409 the send path means to report.
 */
function isUniqueViolation(error: unknown): boolean {
  let current = error;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}
