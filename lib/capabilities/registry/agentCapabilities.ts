import { capabilities } from "./capabilities";

/** What the agent may call, in registry order. */
export const agentCapabilities = capabilities.filter((capability) =>
  capability.callers.includes("agent"),
);
