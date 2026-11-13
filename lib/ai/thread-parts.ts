import type { UIMessage } from "ai";

/**
 * What the dashboard thread renders for one message. The AI SDK streams text,
 * reasoning and tool calls as parts of the same message, and only some of them
 * belong on screen; this module decides which, and how a tool call reads.
 *
 * Pure, so the composer stays a renderer and the rules can be tested without a
 * model, a stream or a DOM.
 */

export type ToolTraceStatus = "running" | "done" | "error";

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
};

export type ThreadBlock =
  | { kind: "text"; key: string; text: string }
  | { kind: "tool"; key: string; trace: ToolTrace };

type ToolUiPart = Extract<
  UIMessage["parts"][number],
  { type: `tool-${string}` } | { type: "dynamic-tool" }
>;

/**
 * How one tool reads in the thread. A tool without an entry still gets a line:
 * its name is humanised, so adding a tool never hides its calls from the person
 * watching the agent work.
 */
type ToolDescriptor = {
  title: string;
  subject: (input: unknown) => string | null;
  /** A refusal the tool returned as a normal result rather than an error. */
  failure: (output: unknown) => string | null;
};

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function quoted(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? `“${value.trim()}”`
    : null;
}

const TOOL_DESCRIPTORS: Record<string, ToolDescriptor> = {
  // Kept in sync with `CREATE_WORKSPACE_TOOL`; a tool part is matched by name.
  createWorkspace: {
    title: "Create workspace",
    subject: (input) => quoted(field(input, "name")),
    failure: (output) =>
      field(output, "created") === false
        ? ((field(output, "error") as string | undefined) ??
          "The workspace could not be created.")
        : null,
  },
};

/** "createWorkspace" → "Create workspace" for a tool with no descriptor. */
function humaniseToolName(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();

  return spaced.length > 0
    ? `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`
    : "Tool call";
}

function toolNameOf(part: ToolUiPart): string {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
}

function isToolPart(part: UIMessage["parts"][number]): part is ToolUiPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

/**
 * A tool part as a readable trace. The SDK moves the same call through states
 * as it streams, so the status here is the one the person should see now.
 */
export function toolTrace(part: ToolUiPart): ToolTrace {
  const name = toolNameOf(part);
  const descriptor = TOOL_DESCRIPTORS[name];
  const input = "input" in part ? part.input : undefined;
  const output = part.state === "output-available" ? part.output : undefined;

  const refused =
    part.state === "output-available" && descriptor
      ? descriptor.failure(part.output)
      : null;

  let status: ToolTraceStatus;
  let error: string | null = null;
  if (part.state === "output-error") {
    status = "error";
    error = part.errorText;
  } else if (part.state === "output-denied") {
    status = "error";
    error = "The call was not approved, so it did not run.";
  } else if (refused) {
    status = "error";
    error = refused;
  } else if (part.state === "output-available") {
    status = "done";
  } else {
    status = "running";
  }

  return {
    toolCallId: part.toolCallId,
    name,
    title: descriptor?.title ?? humaniseToolName(name),
    subject: input === undefined ? null : (descriptor?.subject(input) ?? null),
    status,
    input,
    output,
    error,
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
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}
