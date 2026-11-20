import type { AgentPromptStatus } from "@/lib/collab/contracts";

/** Every move a prompt row makes once it exists. */
export type PromptTransition =
  /** A queued prompt starts streaming. */
  | { transition: "start"; now?: Date }
  /** An answered approval puts a parked prompt back to work. */
  | { transition: "resume" }
  /** A retry puts a failed prompt back to work on the same row. */
  | { transition: "reopen"; now?: Date }
  /** The stream ended, in whatever status it ended in. */
  | {
      transition: "finish";
      status: PromptEnding;
      error: string | null;
      usage?: unknown;
      now?: Date;
    }
  /** Nothing is streaming the prompt any more, so it is failed on its behalf. */
  | { transition: "retire"; error: string; now?: Date }
  /** A branch copies a turn as finished history; it never ran in that thread. */
  | { transition: "history" };

/** A status a turn can end in; QUEUED and RUNNING are on the way, not endings. */
export type PromptEnding = Exclude<AgentPromptStatus, "QUEUED" | "RUNNING">;

/**
 * The columns a transition writes. The clock and the error move with the
 * status, so no writer can close a prompt without closing its clock or reopen
 * one over the failure it replaces.
 */
export type PromptStatusColumns = {
  status: AgentPromptStatus;
  startedAt?: Date;
  finishedAt?: Date | null;
  error?: string | null;
  usage?: unknown;
};
