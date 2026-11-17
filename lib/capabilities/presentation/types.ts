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
