/**
 * How a capability reads in the conversation, and the helpers its presenters
 * use. Free of server imports and of any domain: the thread is a client
 * component, and it must not pull a context's persistence in just to label a
 * tool call.
 */

export type ToolPresentation = {
  /** The action, e.g. "Archive workspace". */
  title: string;
  /** What it acted on, e.g. the workspace name. */
  subject?: string | null;
};

/** Reads a field from a tool input the thread only knows as `unknown`. */
export function field(input: unknown, key: string): unknown {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)[key]
    : undefined;
}

export function quoted(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? `“${value.trim()}”` : null;
}
