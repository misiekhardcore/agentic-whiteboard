import { docAppend } from "./capabilities/doc-append";
import { docConnection } from "./capabilities/doc-connection";
import { docRead } from "./capabilities/doc-read";
import { docReplace } from "./capabilities/doc-replace";
import { docSave } from "./capabilities/doc-save";
import { readWorkspace } from "./capabilities/read-workspace";

/**
 * Every capability the app offers. The list is the single place that says what
 * exists; `callers` decides what the agent may reach.
 */
export const capabilities = [
  readWorkspace,
  docConnection,
  docRead,
  docAppend,
  docReplace,
  docSave,
] as const;

/** What the agent may call, in registry order. */
export const agentCapabilities = capabilities.filter((capability) =>
  capability.callers.includes("agent"),
);
