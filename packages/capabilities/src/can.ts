import type { Actor, Caller } from "@v2/contracts";

export const WORKSPACE_ACTIONS = ["workspace.read"] as const;

export type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

export type WorkspaceResource = {
  accountId: string;
  archived: boolean;
};

type Policy = (actor: Actor, resource: WorkspaceResource) => boolean;

/**
 * One table for both actors. A person's click and an agent's proposal differ in
 * who answers, never in what runs, so the rule lives in one cell each rather
 * than in a branch at each entry point.
 */
const POLICY: Record<WorkspaceAction, Record<Caller, Policy>> = {
  "workspace.read": {
    human: (actor, resource) => actor.accountId === resource.accountId,
    agent: (actor, resource) => actor.accountId === resource.accountId,
  },
};

export function can(actor: Actor, action: WorkspaceAction, resource: WorkspaceResource): boolean {
  const caller: Caller = actor.type === "user" ? "human" : "agent";
  return POLICY[action][caller](actor, resource);
}
