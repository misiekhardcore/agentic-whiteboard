import type { UIMessage } from "ai";

import {
  approvalReference,
  lastUserText,
  promptProblem,
  promptRequestKind,
  type PromptRequestKind,
} from "../rules";

import { jsonError } from "./internals/jsonError";
import { readConversationId } from "./internals/readConversationId";
import { readMessages } from "./internals/readMessages";
import type { TurnFailure } from "./internals/types";

export type TurnRequest = {
  messages: UIMessage[];
  conversationId: string;
  /** A fresh prompt, or an approval answer continuing a parked one. */
  kind: PromptRequestKind;
  /** The message the browser sent last. */
  newest: UIMessage;
  /** The approval being answered, for a continuation. */
  reference: string | null;
};

/**
 * Reads and validates the turn's body before anything is written: the browser
 * may be stale, so the body is checked here and its history is re-read later.
 */
export function readTurnRequest(payload: unknown): TurnRequest | TurnFailure {
  const messages = readMessages(payload);
  if (!messages) {
    return { error: jsonError("Send at least one prompt to the agent.", 400) };
  }

  const conversation = readConversationId(payload);
  if ("error" in conversation) {
    return { error: jsonError(conversation.error, 400) };
  }

  const kind = promptRequestKind(messages);
  const newest = messages[messages.length - 1];

  if (kind === "new" && newest.role !== "user") {
    return { error: jsonError("Send a prompt to the agent.", 400) };
  }

  if (kind === "new") {
    const prompt = lastUserText(messages);
    const problem = promptProblem(prompt ?? "");
    if (!prompt || problem) {
      return { error: jsonError(problem ?? "Write a prompt first.", 400) };
    }
  }

  const reference = kind === "continuation" ? approvalReference(newest) : null;
  if (kind === "continuation" && !reference) {
    return {
      error: jsonError("Send the approval from the conversation it belongs to.", 400),
    };
  }

  return { messages, conversationId: conversation.id, kind, newest, reference };
}
