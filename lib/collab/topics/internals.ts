import { CollabTopicError } from "./CollabTopicError";

export /**
 * Entities are cuid2/Better Auth ids: no colons, so they cannot forge another
 * workspace's topic or document name.
 */
const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const WORKSPACE_DOCUMENT_PATTERN = /^workspace:([A-Za-z0-9_-]{1,64}):(doc|canvas)$/;

export function assertEntityId(label: string, value: string): string {
  if (!ENTITY_ID_PATTERN.test(value)) {
    throw new CollabTopicError(label, value);
  }
  return value;
}
