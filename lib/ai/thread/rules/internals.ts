import type { UIMessage } from "ai";

import type { AgentMessageRole } from "@/lib/collab/contracts";

import type { PromptPosition } from "./types";

export type StoredContent = { parts: unknown };

export const ROLE_BY_STORED: Record<AgentMessageRole, UIMessage["role"]> = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
};

export type ToolPart = Extract<
  UIMessage["parts"][number],
  { type: `tool-${string}` } | { type: "dynamic-tool" }
>;

export function isToolPart(part: UIMessage["parts"][number]): part is ToolPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

export function toolCallIdOf(part: ToolPart): string {
  return part.toolCallId;
}

export function before(a: PromptPosition, b: PromptPosition): boolean {
  const at = a.createdAt.getTime();
  const bt = b.createdAt.getTime();

  return at < bt || (at === bt && a.id < b.id);
}

export const SETTLED_STATES = new Set([
  "output-available",
  "output-error",
  "output-denied",
  "approval-responded",
]);
