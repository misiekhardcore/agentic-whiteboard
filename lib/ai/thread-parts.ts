import type { UIMessage } from "ai";

import { CLIENT_TOOL_NAMES, toolPresentations } from "@/lib/capabilities/presentation";

/**
 * What the dashboard thread renders for one message. The AI SDK streams text,
 * reasoning, tool calls and approval requests as parts of the same message, and
 * only some of them belong on screen; this module decides which, and how a tool
 * call reads.
 *
 * Pure, and free of server imports: the titles come from the same presentation
 * module the capabilities use, so a tool cannot be labelled one way for the
 * model and another for the person.
 */

export type ToolTraceStatus = "running" | "done" | "error" | "awaiting-approval";

/** One tool call, shaped for a single line in the conversation. */
export type ToolTrace = {
  toolCallId: string;
  name: string;
  /** The action, e.g. "Create workspace". */
  title: string;
  /** What it acted on, shown beside the title, e.g. the workspace name. */
  subject: string | null;
  status: ToolTraceStatus;
  input: unknown;
  output: unknown;
  /** Why the call failed, when it did. */
  error: string | null;
  /** What to try instead, when the capability offered one. */
  hint: string | null;
  /** The id to answer with, while the person's decision is outstanding. */
  approvalId: string | null;
  /** Performed by the browser, so there is no server result to wait for. */
  client: boolean;
};

export type ThreadBlock =
  { kind: "text"; key: string; text: string } | { kind: "tool"; key: string; trace: ToolTrace };

type ToolUiPart = Extract<
  UIMessage["parts"][number],
  { type: `tool-${string}` } | { type: "dynamic-tool" }
>;

function toolNameOf(part: ToolUiPart): string {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
}

function isToolPart(part: UIMessage["parts"][number]): part is ToolUiPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

/** "createWorkspace" → "Create workspace" for a tool with no presentation. */
function humaniseToolName(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();

  return spaced.length > 0 ? `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}` : "Tool call";
}

/** A refusal the capability returned as a value rather than as an error. */
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

/**
 * A tool part as a readable trace. The SDK moves the same call through states
 * as it streams, so the status here is the one the person should see now.
 */
export function toolTrace(part: ToolUiPart): ToolTrace {
  const name = toolNameOf(part);
  const presentation = toolPresentations[name];
  const input = "input" in part ? part.input : undefined;
  const client = CLIENT_TOOL_NAMES.includes(name);

  const output = part.state === "output-available" ? part.output : undefined;
  const refused = refusal(output);

  let status: ToolTraceStatus;
  let error: string | null = null;
  let hint: string | null = null;

  if (part.state === "output-error") {
    status = "error";
    error = part.errorText;
  } else if (part.state === "output-denied") {
    status = "error";
    error = "You denied this action, so it did not run.";
  } else if (refused) {
    status = "error";
    error = refused.error;
    hint = refused.hint;
  } else if (part.state === "approval-requested") {
    status = "awaiting-approval";
    error = part.approval.requestReason ?? null;
  } else if (part.state === "approval-responded") {
    if (part.approval.approved) {
      status = "running";
    } else {
      status = "error";
      error = part.approval.reason ?? "You denied this action, so it did not run.";
    }
  } else if (part.state === "output-available") {
    status = "done";
  } else if (client && part.state === "input-available") {
    // Nothing runs on the server: the browser opened the target.
    status = "done";
  } else {
    status = "running";
  }

  const shown = presentation ? presentation(input) : undefined;

  return {
    toolCallId: part.toolCallId,
    name,
    title: shown?.title ?? humaniseToolName(name),
    subject: shown?.subject ?? null,
    status,
    input,
    output,
    error,
    hint,
    approvalId: part.state === "approval-requested" ? part.approval.id : null,
    client,
  };
}

/**
 * The message as the thread shows it: its replies, and the tool calls between
 * them, in stream order. Reasoning is not shown — it is the model's working, and
 * a distilled or reasoning-tuned model emits it before every answer.
 */
export function threadBlocks(message: UIMessage): ThreadBlock[] {
  return message.parts.flatMap((part, index): ThreadBlock[] => {
    if (part.type === "text") {
      return part.text.trim().length > 0
        ? [{ kind: "text", key: String(index), text: part.text }]
        : [];
    }

    if (isToolPart(part)) {
      return [{ kind: "tool", key: String(index), trace: toolTrace(part) }];
    }

    return [];
  });
}

/** The message's prose alone, without its tool calls. */
export function threadText(message: UIMessage): string {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}
