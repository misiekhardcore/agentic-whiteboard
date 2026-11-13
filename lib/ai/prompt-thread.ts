import type { UIMessage } from "ai";

import type {
  AgentMessageRole,
  AgentPromptStatus,
} from "../collab/contracts";

/**
 * Rules for the dashboard's prompt thread. Pure, so the route, the persistence
 * adapter and the composer can share one definition of a sendable prompt and
 * one mapping between stored messages and AI SDK messages.
 */

export const PROMPT_MAX_LENGTH = 4000;

/** A persisted message, shaped the way `agentMessage` stores it. */
export type StoredPromptMessage = {
  id: string;
  role: AgentMessageRole;
  parts: UIMessage["parts"];
};

const ROLE_BY_STORED: Record<AgentMessageRole, UIMessage["role"]> = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
};

/**
 * What is wrong with a draft, or `null` when it can be sent. The route re-checks
 * the prompt even though the composer disables sending: the endpoint is the
 * trust boundary, and an empty or oversized prompt must not create a record.
 */
export function promptProblem(prompt: string): string | null {
  if (prompt.trim().length === 0) {
    return "Write a prompt so the agent knows what to plan.";
  }

  if (prompt.trim().length > PROMPT_MAX_LENGTH) {
    return `Keep the prompt under ${PROMPT_MAX_LENGTH.toLocaleString("en-US")} characters.`;
  }

  return null;
}

/**
 * The newest prompt in a conversation. The client sends the whole thread, but
 * only the last user message is new; earlier ones are already stored.
 */
export function lastUserText(messages: UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;

    const text = message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n");

    return text.length > 0 ? text : null;
  }

  return null;
}

/**
 * Replays a stored thread as AI SDK messages. The role is upper-cased in
 * Postgres to match the enum convention and lower-cased back here, because the
 * UI and the agent both speak the SDK's `UIMessage`.
 */
export function threadMessages(rows: StoredPromptMessage[]): UIMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: ROLE_BY_STORED[row.role],
    parts: row.parts,
  }));
}

export type PromptStreamOutcome = {
  /** The client stopped the response, or disconnected. */
  isAborted: boolean;
  /** The SDK reports a consumer that cancelled before the stream ended. */
  isCancelled?: true;
  /** The provider failed; `onError` ran during the stream. */
  failed: boolean;
};

/**
 * The status a prompt ends in. A failure wins over an abort so the operator can
 * tell a broken provider from someone pressing Stop.
 */
export function promptStatusAfterStream({
  isAborted,
  isCancelled,
  failed,
}: PromptStreamOutcome): AgentPromptStatus {
  if (failed) return "FAILED";
  if (isAborted || isCancelled) return "CANCELLED";
  return "COMPLETED";
}
