import { type UIMessage } from "ai";

import { isUIMessage } from "./isUIMessage";

export function readMessages(payload: unknown): UIMessage[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return messages.every(isUIMessage) ? messages : null;
}
