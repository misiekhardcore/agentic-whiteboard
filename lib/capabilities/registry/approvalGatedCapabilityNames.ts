import { capabilities } from "./capabilities";

/** The capabilities whose agent calls must be confirmed by the person. */
export const approvalGatedCapabilityNames = capabilities
  .filter((capability) => capability.approval)
  .map((capability) => capability.name);
