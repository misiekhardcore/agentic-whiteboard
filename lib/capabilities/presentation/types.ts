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

/**
 * One tool as the thread reads it: the label, and whether the browser performs
 * the call. Each context declares its own lines, keyed by capability name, so
 * the label lives once instead of on the capability and in a second map.
 */
export type ToolLine = {
  present: (input: unknown) => ToolPresentation;
  /** The browser performs this call; there is no server result to wait for. */
  client?: boolean;
};

export type ToolCatalogue = Record<string, ToolLine>;
