import type { Change } from "@/lib/capabilities/define";
import type { AccountActor } from "@/lib/identity/actor";

/**
 * Tools are built per run from the capability registry and close over the
 * authenticated actor, so the model chooses among permitted operations but
 * never supplies the account or user id. Every tool delegates to the same
 * `invoke()` the human actions use.
 *
 * A capability marked `approval: "always"` pauses for the person's decision.
 * That only works when the run can sign its approval requests; without the
 * secret those tools are not offered at all, rather than exposing an action
 * whose "approved" could be forged by a client.
 */
export type WorkspaceToolActor = AccountActor;

export type WorkspaceToolOptions = {
  /** The prompt this run belongs to; the tools carry it as their actor. */
  promptId?: string;
  /** Approval-gated capabilities are offered only when this is true. */
  allowApprovalTools?: boolean;
  /** Told what a call changed, so the reply can carry it back to the browser. */
  onChanges?: (changes: Change[]) => void;
};
