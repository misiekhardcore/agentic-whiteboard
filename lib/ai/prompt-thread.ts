import type { UIMessage } from "ai";

import type { AgentMessageRole, AgentPromptStatus } from "../collab/contracts";

/**
 * Rules for the dashboard's prompt thread. Pure, so the route, the persistence
 * adapter and the composer can share one definition of a sendable prompt, one
 * mapping between stored messages and AI SDK messages, and one answer to "is
 * this a new prompt or the answer to one the agent is waiting on?".
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

type ToolPart = Extract<
  UIMessage["parts"][number],
  { type: `tool-${string}` } | { type: "dynamic-tool" }
>;

function isToolPart(part: UIMessage["parts"][number]): part is ToolPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function toolCallIdOf(part: ToolPart): string {
  return part.toolCallId;
}

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
 * A message that still asks the person to decide. The run ends with the tool
 * call parked in `approval-requested`, so the prompt is not finished — it is
 * waiting.
 */
export function hasPendingApproval(message: UIMessage): boolean {
  return message.parts.some((part) => isToolPart(part) && part.state === "approval-requested");
}

/**
 * The reference the browser answers with. The SDK mints it per request (and
 * signs it when a secret is configured), so it is also the safest thing to
 * match a continuation against: the tool call id alone would let a second
 * thread answer the first one's question.
 */
export function approvalReference(message: UIMessage): string | null {
  for (const part of message.parts) {
    if (!isToolPart(part)) continue;
    if (part.state !== "approval-requested" && part.state !== "approval-responded") {
      continue;
    }
    return part.approval.id;
  }

  return null;
}

export type PromptRequestKind = "new" | "continuation";

/**
 * A send either starts a prompt or answers the one the agent parked. An
 * approval response lives on the assistant message it belongs to, so the last
 * message tells the two apart; everything else is a new prompt.
 */
export function promptRequestKind(messages: UIMessage[]): PromptRequestKind {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return "new";

  return last.parts.some(
    (part) =>
      isToolPart(part) &&
      (part.state === "approval-requested" || part.state === "approval-responded"),
  )
    ? "continuation"
    : "new";
}

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

const SETTLED_STATES = new Set([
  "output-available",
  "output-error",
  "output-denied",
  "approval-responded",
]);

/**
 * An approval request is stored with the message that made it, so a reload can
 * still show the question. The answer arrives as a second message for the same
 * tool call, which would otherwise replay a card whose answer is already below
 * it — so the stale request is dropped from the thread, while the message's
 * prose stays.
 *
 * Walks newest first: a call settled further down the thread settles the
 * request above it.
 */
export function supersedeApprovals<T extends StoredPromptMessage>(rows: readonly T[]): T[] {
  const settled = new Set<string>();
  const kept = rows.map((row) => ({ ...row }));

  for (let index = kept.length - 1; index >= 0; index -= 1) {
    const row = kept[index];

    const stale = row.parts.filter(
      (part) =>
        isToolPart(part) && part.state === "approval-requested" && settled.has(toolCallIdOf(part)),
    );

    if (stale.length > 0) {
      const staleIds = new Set(stale.map((part) => toolCallIdOf(part as ToolPart)));
      kept[index] = {
        ...row,
        parts: row.parts.filter((part) => !isToolPart(part) || !staleIds.has(toolCallIdOf(part))),
      };
    }

    for (const part of row.parts) {
      if (isToolPart(part) && SETTLED_STATES.has(part.state)) {
        settled.add(toolCallIdOf(part));
      }
    }
  }

  return kept;
}

/**
 * Adds two AI SDK usage objects leaf by leaf. An approval's continuation is
 * part of the same prompt, so its tokens are added to what the first step
 * already recorded instead of replacing them.
 */
export function addUsage(previous: unknown, next: unknown): unknown {
  if (typeof previous !== "object" || previous === null) return next ?? previous;
  if (typeof next !== "object" || next === null) return previous;

  const added: Record<string, unknown> = { ...(previous as Record<string, unknown>) };

  for (const [key, value] of Object.entries(next)) {
    const before = added[key];
    if (before === undefined) {
      added[key] = value;
    } else if (typeof before === "number" && typeof value === "number") {
      added[key] = before + value;
    } else if (typeof before === "object" && typeof value === "object") {
      added[key] = addUsage(before, value);
    }
  }

  return added;
}

export type PromptStreamOutcome = {
  /** The client stopped the response, or disconnected. */
  isAborted: boolean;
  /** The SDK reports a consumer that cancelled before the stream ended. */
  isCancelled?: true;
  /** The provider failed; `onError` ran during the stream. */
  failed: boolean;
  /** The run parked a tool call until the person answers. */
  awaitingApproval?: boolean;
};

/**
 * The status a prompt ends in. A failure wins over an abort so the operator can
 * tell a broken provider from someone pressing Stop; a parking approval is not
 * an ending, so it outranks a completion but never a failure.
 */
export function promptStatusAfterStream({
  isAborted,
  isCancelled,
  failed,
  awaitingApproval,
}: PromptStreamOutcome): AgentPromptStatus {
  if (failed) return "FAILED";
  if (isAborted || isCancelled) return "CANCELLED";
  if (awaitingApproval) return "AWAITING_APPROVAL";
  return "COMPLETED";
}
