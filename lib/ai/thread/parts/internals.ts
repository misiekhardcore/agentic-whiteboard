import type { UIMessage } from "ai";

export type ToolUiPart = Extract<
  UIMessage["parts"][number],
  { type: `tool-${string}` } | { type: "dynamic-tool" }
>;

export function toolNameOf(part: ToolUiPart): string {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
}

export function isToolPart(part: UIMessage["parts"][number]): part is ToolUiPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

export /** "createWorkspace" → "Create workspace" for a tool with no presentation. */
function humaniseToolName(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();

  return spaced.length > 0 ? `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}` : "Tool call";
}

export /** A refusal the capability returned as a value rather than as an error. */
function refusal(output: unknown): { error: string; hint: string | null } | null {
  if (typeof output !== "object" || output === null) return null;
  const { ok, error, hint } = output as {
    ok?: unknown;
    error?: unknown;
    hint?: unknown;
  };

  if (ok !== false) return null;

  return {
    error: typeof error === "string" && error.length > 0 ? error : "The call was refused.",
    hint: typeof hint === "string" && hint.length > 0 ? hint : null,
  };
}
