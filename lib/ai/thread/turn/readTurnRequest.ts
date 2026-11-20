import type { UIMessage } from "ai";

import { type UiContext, uiContextSchema } from "@/lib/ai/runtime/instructions";

import {
  conversationIdProblem,
  lastUserText,
  promptProblem,
  promptRequestKind,
  type PromptRequestKind,
} from "../rules";

import { jsonError } from "./internals/jsonError";
import type { TurnFailure } from "./internals/types";

export type TurnRequest = {
  messages: UIMessage[];
  conversationId: string;
  /** A fresh prompt, or an approval answer continuing a parked one. */
  kind: PromptRequestKind;
  /** The message the browser sent last. */
  newest: UIMessage;
  /** The view the person is on, when the browser sent a valid one. */
  uiContext: UiContext | null;
};

/**
 * Reads and validates the turn's body before anything is written. A new prompt's
 * stored turns are what the model later sees; a continuation streams this body.
 */
export function readTurnRequest(payload: unknown): TurnRequest | TurnFailure {
  const messages = readMessages(payload);
  if (!messages) {
    return { error: jsonError("Send at least one prompt to the agent.", 400) };
  }

  const conversation = readConversationId(payload);
  if ("problem" in conversation) {
    return { error: jsonError(conversation.problem, 400) };
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

  return {
    messages,
    conversationId: conversation.id,
    kind,
    newest,
    uiContext: readUiContext(payload),
  };
}

function isUIMessage(value: unknown): value is UIMessage {
  if (typeof value !== "object" || value === null) return false;

  const message = value as { id?: unknown; role?: unknown; parts?: unknown };
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    Array.isArray(message.parts)
  );
}

function readMessages(payload: unknown): UIMessage[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  return messages.every(isUIMessage) ? messages : null;
}

/**
 * The conversation the composer is on. Its id is chosen before the first prompt
 * (a UUID the browser makes for "New conversation"), so the route creates the
 * row with the first accepted prompt.
 */
function readConversationId(payload: unknown): { id: string } | { problem: string } {
  const raw =
    typeof payload === "object" && payload !== null
      ? (payload as { conversationId?: unknown }).conversationId
      : undefined;
  const problem = conversationIdProblem(typeof raw === "string" ? raw : "");

  return problem ? { problem } : { id: raw as string };
}

/** The view the browser says the person is on; an invalid one is ignored. */
function readUiContext(payload: unknown): UiContext | null {
  if (typeof payload !== "object" || payload === null) return null;
  const parsed = uiContextSchema.safeParse((payload as { uiContext?: unknown }).uiContext);

  return parsed.success ? parsed.data : null;
}
