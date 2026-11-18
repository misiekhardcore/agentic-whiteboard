import type { Change } from "@/lib/shared/changes";

import { broadcastChanges } from "./broadcastChanges";
import { groupChanges } from "./groupChanges";
import type { ChangeActor } from "./types";

/**
 * Publishes what a successful call changed, whichever caller ran it: a person's
 * action, a capability the agent invoked, or a background job such as naming a
 * conversation. Nothing here can fail the caller's work — a broadcast is a
 * freshness hint, and the database already holds the change.
 */
export async function publishChanges({
  changes,
  actor,
}: {
  changes: Change[];
  actor: ChangeActor;
}): Promise<void> {
  if (changes.length === 0) return;
  await broadcastChanges(groupChanges(changes, actor));
}
