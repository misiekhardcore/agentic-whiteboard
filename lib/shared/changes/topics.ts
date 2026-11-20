import { ChangesTopicError } from "./ChangesTopicError";
import { CHANGE_TOPIC_PREFIX } from "./constants";

/** Entities are cuid2/Better Auth ids: no colons, so they cannot forge a topic. */
const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertEntityId(label: string, value: string): string {
  if (!ENTITY_ID_PATTERN.test(value)) {
    throw new ChangesTopicError(label, value);
  }
  return value;
}

/** The changes one person may be told about, whichever account they are in. */
export function personChangesTopic(userId: string): string {
  return `${CHANGE_TOPIC_PREFIX}user:${assertEntityId("user id", userId)}`;
}

/** The changes everyone in one organization may be told about. */
export function organizationChangesTopic(organizationId: string): string {
  return `${CHANGE_TOPIC_PREFIX}org:${assertEntityId("organization id", organizationId)}`;
}

/** One workspace's own page, as opposed to the lists it appears in. */
export function workspaceChangeKey(workspaceId: string): string {
  return `workspace:${assertEntityId("workspace id", workspaceId)}`;
}
