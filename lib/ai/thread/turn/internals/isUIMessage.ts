import { type UIMessage } from "ai";

export function isUIMessage(value: unknown): value is UIMessage {
  if (typeof value !== "object" || value === null) return false;

  const message = value as { id?: unknown; role?: unknown; parts?: unknown };
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    Array.isArray(message.parts)
  );
}
