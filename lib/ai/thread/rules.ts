import type { UIMessage } from "ai";

import type { AgentMessageRole, AgentPromptStatus } from "@/lib/collab/contracts";

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

type StoredContent = { parts: unknown };

/**
 * The parts of a stored row. Only a well-formed `{ parts }` array is replayed;
 * anything else would break `useChat`, so an unreadable row is skipped rather
 * than crashing the page.
 */
export function storedParts(content: unknown): UIMessage["parts"] {
  if (typeof content !== "object" || content === null) return [];
  const parts = (content as Partial<StoredContent>).parts;
  return Array.isArray(parts) ? (parts as UIMessage["parts"]) : [];
}

/** The prose of a stored row, without its tool calls. */
export function storedText(content: unknown): string {
  return storedParts(content)
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}

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
 * only the last user message is new; earlier ones are already stored. Editing or
 * retrying a turn needs the message itself, not just its words, because its id is
 * what names the stored prompt.
 */
export function lastUserMessage(messages: UIMessage[]): UIMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index];
  }

  return null;
}

export function lastUserText(messages: UIMessage[]): string | null {
  const message = lastUserMessage(messages);
  if (!message) return null;

  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");

  return text.length > 0 ? text : null;
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
 * A stored user message that the newest send may continue: its prompt, the
 * status that prompt ended in, whether it is the conversation's newest live
 * prompt, and the text the person originally sent.
 */
export type PromptTarget = {
  promptId: string;
  status: AgentPromptStatus;
  isTip: boolean;
  text: string;
};

export type PromptIntent =
  /** A prompt the conversation has not seen: write a new one. */
  | { kind: "append" }
  /** Re-run the newest prompt that failed, reusing its row. */
  | { kind: "retry"; promptId: string }
  /** Replace this prompt and everything after it with a new one. */
  | { kind: "rewind"; fromPromptId: string };

/** The last prompt of a conversation is the only one a retry may reuse. */
export function promptCanRetry(status: AgentPromptStatus): boolean {
  return status === "FAILED";
}

/**
 * What a send does to the conversation, from the one stored message it repeats.
 *
 * Sending a user message again is either an edit or a retry, and the difference
 * is the person's, not the client's: a failed prompt whose text did not change is
 * retried for free, because the person already paid for it and got nothing back.
 * Everything else — a changed text, a prompt that already succeeded, a send from
 * the middle of the thread — discards the turns after that point and starts a new
 * prompt, so the allowance follows the work that actually runs.
 */
export function promptIntent({
  text,
  target,
}: {
  text: string;
  target: PromptTarget | null;
}): PromptIntent {
  if (!target) return { kind: "append" };

  const unchanged = target.text.trim() === text.trim();
  if (target.isTip && promptCanRetry(target.status) && unchanged) {
    return { kind: "retry", promptId: target.promptId };
  }

  return { kind: "rewind", fromPromptId: target.promptId };
}

/** A prompt's place in its conversation: creation order, ties broken by id. */
export type PromptPosition = { id: string; createdAt: Date };

function before(a: PromptPosition, b: PromptPosition): boolean {
  const at = a.createdAt.getTime();
  const bt = b.createdAt.getTime();

  return at < bt || (at === bt && a.id < b.id);
}

/**
 * The prompts a rewind discards: every live prompt at or after the branch point,
 * in order. The branch is a position rather than a list index because the id the
 * browser sends may already be superseded — editing the same prompt twice in one
 * session resends the id of a prompt an earlier edit replaced — so filtering by
 * position discards exactly the turns that came after it either way.
 */
export function promptsFromBranch<T extends PromptPosition>(
  ordered: readonly T[],
  branch: PromptPosition,
): T[] {
  return ordered.filter((prompt) => !before(prompt, branch));
}

/**
 * Whether a turn may be copied into a branch.
 *
 * A branch is a copy of history, so it may only take a turn that has finished.
 * A prompt still queued, running or parked on an approval is a question the copy
 * could not answer — and answering it would resume the turn in the conversation
 * it came from, since the parked row is found by its approval reference.
 */
export function branchableStatus(status: AgentPromptStatus): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
}

/**
 * The prompts that make up a turn's history: every live prompt up to and
 * including it. A turn's history is read from here rather than from the browser,
 * so a discarded or foreign turn cannot be replayed into the model.
 */
export function promptsThrough<T extends PromptPosition>(
  ordered: readonly T[],
  through: PromptPosition,
): T[] {
  return ordered.filter((prompt) => !before(through, prompt));
}

/**
 * Folds the browser's approval answer into the stored turn. The answer is the
 * only thing a continuation may contribute: it is matched to the stored request
 * by its approval reference and tool call, everything else stays as stored, and
 * the message keeps the browser's id because the streamed continuation reuses
 * the id of the last assistant message that browser holds.
 *
 * Returns null when the body does not answer the question the stored turn asked.
 */
export function applyApprovalAnswer({
  history,
  answer,
  reference,
}: {
  history: UIMessage[];
  answer: UIMessage;
  reference: string;
}): UIMessage[] | null {
  if (answer.role !== "assistant") return null;

  const answered = answer.parts.find(
    (part) =>
      isToolPart(part) && part.state === "approval-responded" && part.approval.id === reference,
  ) as ToolPart | undefined;
  if (!answered) return null;

  const askedAt = history.findLastIndex((message) =>
    message.parts.some(
      (part) =>
        isToolPart(part) &&
        part.approval?.id === reference &&
        part.toolCallId === answered.toolCallId,
    ),
  );
  if (askedAt < 0) return null;

  const stored = history[askedAt];
  return history.map((message, index) =>
    index === askedAt
      ? {
          ...stored,
          id: answer.id,
          parts: stored.parts.map((part) =>
            isToolPart(part) && part.toolCallId === answered.toolCallId ? answered : part,
          ),
        }
      : message,
  );
}

/** One entry in the dashboard's conversation switcher. */
export type DashboardConversation = {
  id: string;
  preview: string;
  updatedAt: Date;
};

/**
 * One conversation as the history endpoint sends it: the same entry, with the
 * date as JSON carries it. The client parses it back into a `Date` before
 * formatting, so both sides agree on what the field is.
 */
export type ConversationHistoryEntry = {
  id: string;
  preview: string;
  updatedAt: string;
};

/**
 * How many conversations the history dialog offers. It is a bound rather than a
 * page size: the dialog is a scroll box of labels, and asking for more than a
 * person will ever scroll through costs a query that reads the same either way.
 */
export const CONVERSATION_HISTORY_LIMIT = 200;

/** How long a conversation's label may be before it is cut. */
export const CONVERSATION_PREVIEW_LENGTH = 48;

/**
 * The label the conversation switcher shows: the first prompt on one line. A
 * conversation nobody has written in yet is named by its state, not by an empty
 * string.
 */
export function conversationPreview(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length === 0) return "New conversation";

  return line.length <= CONVERSATION_PREVIEW_LENGTH
    ? line
    : `${line.slice(0, CONVERSATION_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

/**
 * A conversation id reaches the route from the browser, so it is checked for
 * shape before it is used in a query. Random UUIDs (a new thread) and the
 * migration's `legacy-<userId>` ids both pass; the id only ever selects data the
 * session's own user owns.
 */
export function conversationIdProblem(id: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(id)
    ? null
    : "Send the conversation this prompt belongs to.";
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
