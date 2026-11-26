/**
 * A person acting with their own session. The account is the tenancy scope the
 * request acts in; it is read server-side and never supplied by a caller.
 */
export type UserActor = {
  type: "user";
  userId: string;
  accountId: string;
};

/**
 * The agent acting as its own participant, always on behalf of the person who
 * requested the run. The run's credential narrows what it may do; it never
 * widens it.
 */
export type AgentActor = {
  type: "agent";
  runId: string;
  accountId: string;
  requestedByUserId: string;
};

export type Actor = UserActor | AgentActor;

/** How a capability names the callers it exposes itself to. */
export type Caller = "human" | "agent";

export function callerOf(actor: Actor): Caller {
  return actor.type === "user" ? "human" : "agent";
}
