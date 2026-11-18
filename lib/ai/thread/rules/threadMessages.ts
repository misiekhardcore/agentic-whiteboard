import type { UIMessage } from "ai";

import { ROLE_BY_STORED } from "./internals";
import { supersedeApprovals } from "./supersedeApprovals";
import type { StoredPromptMessage } from "./types";

/**
 * Replays a stored thread as AI SDK messages. The role is upper-cased in
 * Postgres to match the enum convention and lower-cased back here, because the
 * UI and the agent both speak the SDK's `UIMessage`.
 */
export function threadMessages(rows: StoredPromptMessage[]): UIMessage[] {
  return supersedeApprovals(rows).map((row) => ({
    id: row.id,
    role: ROLE_BY_STORED[row.role],
    parts: row.parts,
  }));
}
