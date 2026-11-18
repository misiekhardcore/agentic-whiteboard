import {
  type Capability,
  type CapabilityContext,
  type CapabilityDescriptor,
  type CapabilityOutput,
} from "../define";
import { invoke } from "../invoke";

import { presentation } from "./internals";

export function describeCapability<I, T, R>(capability: Capability<I, T, R>): CapabilityDescriptor {
  return {
    name: capability.name,
    description: capability.description,
    inputSchema: capability.input,
    callers: capability.callers,
    approval: capability.approval === "always",
    present: presentation(capability.present),
    invoke: (ctx: CapabilityContext, raw: unknown): Promise<CapabilityOutput<unknown>> =>
      invoke(capability, ctx, raw),
  };
}
