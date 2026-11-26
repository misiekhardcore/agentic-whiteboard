import { readWorkspace } from "./capabilities/read-workspace";

/**
 * Every capability the app offers. The list is the single place that says what
 * exists; `callers` decides what the agent may reach.
 */
export const capabilities = [readWorkspace] as const;

/** What the agent may call, in registry order. */
export const agentCapabilities = capabilities.filter((capability) =>
  capability.callers.includes("agent"),
);
