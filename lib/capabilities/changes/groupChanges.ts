import { type Change, organizationChangesTopic, personChangesTopic } from "@/lib/shared/changes";

import type { ChangeActor } from "./types";

/**
 * Which channel each change travels on. A person-scoped change stays with the
 * person; an account-scoped change goes to the organization when one is active,
 * and to the person's own channel for a personal account — the same place that
 * person's other changes go, so one subscription covers both.
 *
 * Keys are deduplicated per topic: a capability that touches a workspace twice
 * must not make the browser re-read the page twice.
 */
export function groupChanges(
  changes: Change[],
  actor: ChangeActor,
): { topic: string; keys: string[] }[] {
  const keysByTopic = new Map<string, Set<string>>();

  for (const change of changes) {
    const topic =
      change.scope === "person" || !actor.organizationId
        ? personChangesTopic(actor.userId)
        : organizationChangesTopic(actor.organizationId);

    const keys = keysByTopic.get(topic) ?? new Set<string>();
    keys.add(change.key);
    keysByTopic.set(topic, keys);
  }

  return [...keysByTopic].map(([topic, keys]) => ({ topic, keys: [...keys] }));
}
