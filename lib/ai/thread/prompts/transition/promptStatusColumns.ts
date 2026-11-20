import type { PromptStatusColumns, PromptTransition } from "./types";

/**
 * The prompt columns one transition writes.
 *
 * A status is not a label on its own: an ending closes the clock, a reopen
 * clears the failure it replaces and restarts the clock, a resume keeps the
 * clock because the same turn is still being paid for once, and usage only
 * moves when the close carries it, so a continuation's close cannot erase what
 * the turn already cost.
 */
export function promptStatusColumns(transition: PromptTransition): PromptStatusColumns {
  switch (transition.transition) {
    case "start":
      return { status: "RUNNING", startedAt: transition.now ?? new Date() };

    case "resume":
      return { status: "RUNNING" };

    case "reopen":
      return {
        status: "RUNNING",
        startedAt: transition.now ?? new Date(),
        finishedAt: null,
        error: null,
      };

    case "retire":
      return {
        status: "FAILED",
        error: transition.error,
        finishedAt: transition.now ?? new Date(),
      };

    case "history":
      return { status: "COMPLETED" };

    case "finish": {
      const closed: PromptStatusColumns = {
        status: transition.status,
        error: transition.error,
        finishedAt: transition.now ?? new Date(),
      };

      if (transition.usage !== undefined) closed.usage = transition.usage;

      return closed;
    }
  }
}
