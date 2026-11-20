import { type Change, changeChannels, changeTopicFor } from "@/lib/shared/changes";

import type { ChangeActor } from "./types";

/**
 * Which channel each change travels on, through the same rule the browser's
 * token is built from. Keys are deduplicated per topic: a capability that
 * touches a workspace twice must not make the browser re-read the page twice.
 */
export function groupChanges(
  changes: Change[],
  actor: ChangeActor,
): { topic: string; keys: string[] }[] {
  const channels = changeChannels(actor);
  const keysByTopic = new Map<string, Set<string>>();

  for (const change of changes) {
    const topic = changeTopicFor(change, channels);
    const keys = keysByTopic.get(topic) ?? new Set<string>();
    keys.add(change.key);
    keysByTopic.set(topic, keys);
  }

  return [...keysByTopic].map(([topic, keys]) => ({ topic, keys: [...keys] }));
}
