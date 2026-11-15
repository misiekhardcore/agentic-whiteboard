import { type CapabilityDescriptor, describeCapability, describeClientCapability } from "./define";
import {
  archiveWorkspace,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  openWorkspace,
  restoreWorkspace,
  updateWorkspace,
} from "./workspaces";

/**
 * Every capability the app offers, in the order the agent sees them.
 *
 * The list is the single place that says what exists. An operation missing here
 * is reachable only through its own action, and nothing silently becomes
 * available to the model: `callers` decides that per capability, and
 * `approval` decides whether an agent call waits for a person.
 */
export const capabilities: readonly CapabilityDescriptor[] = [
  describeCapability(createWorkspace),
  describeCapability(listWorkspaces),
  describeCapability(getWorkspace),
  describeCapability(updateWorkspace),
  describeCapability(restoreWorkspace),
  describeCapability(archiveWorkspace),
  describeCapability(deleteWorkspace),
  describeClientCapability(openWorkspace),
];

/** What the agent may call, in registry order. */
export const agentCapabilities = capabilities.filter((capability) =>
  capability.callers.includes("agent"),
);

/** The capabilities whose agent calls must be confirmed by the person. */
export const approvalGatedCapabilityNames = capabilities
  .filter((capability) => capability.approval)
  .map((capability) => capability.name);
