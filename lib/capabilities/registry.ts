import { updatePersonalProfile } from "@/lib/identity/capabilities";
import {
  acceptInvitation,
  cancelInvitation,
  createOrganization,
  inviteMember,
  removeMember,
  switchAccount,
  updateMemberRole,
  updateOrganizationProfile,
} from "@/lib/organizations/capabilities";
import {
  archiveWorkspace,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  openWorkspace,
  restoreWorkspace,
  updateWorkspace,
} from "@/lib/workspace/capabilities";

import { type CapabilityDescriptor } from "./define";
import { describeCapability, describeClientCapability } from "./describe";

/**
 * Every capability the app offers, in the order the agent sees them.
 *
 * The list is the single place that says what exists. An operation missing here
 * is reachable only through its own action, and nothing silently becomes
 * available to the model: `callers` decides that per capability, and
 * `approval` decides whether an agent call waits for a person.
 *
 * Human-only capabilities are registered too. They are not tools, but they are
 * operations with a declared input, a refusal shape and revalidation paths, and
 * a registry test can still hold them to that contract.
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
  describeCapability(createOrganization),
  describeCapability(switchAccount),
  describeCapability(inviteMember),
  describeCapability(updateMemberRole),
  describeCapability(cancelInvitation),
  describeCapability(removeMember),
  describeCapability(acceptInvitation),
  describeCapability(updateOrganizationProfile),
  describeCapability(updatePersonalProfile),
];

/** What the agent may call, in registry order. */
export const agentCapabilities = capabilities.filter((capability) =>
  capability.callers.includes("agent"),
);

/** The capabilities whose agent calls must be confirmed by the person. */
export const approvalGatedCapabilityNames = capabilities
  .filter((capability) => capability.approval)
  .map((capability) => capability.name);
