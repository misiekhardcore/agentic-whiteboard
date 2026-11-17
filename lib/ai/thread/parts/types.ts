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
