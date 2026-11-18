import { type CapabilityDescriptor, type ClientCapability } from "../define";

import { presentation } from "./internals";

export function describeClientCapability<I>(capability: ClientCapability<I>): CapabilityDescriptor {
  return {
    name: capability.name,
    description: capability.description,
    inputSchema: capability.input,
    callers: capability.callers,
    approval: false,
    client: capability.client,
    present: presentation(capability.present),
  };
}
