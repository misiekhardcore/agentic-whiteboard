import {
  type Capability,
  type CapabilityContext,
  type CapabilityDescriptor,
  type CapabilityOutput,
} from "../define";
import { invoke } from "../invoke";

export function describeCapability<I, T, R>(capability: Capability<I, T, R>): CapabilityDescriptor {
  return {
    name: capability.name,
    description: capability.description,
    inputSchema: capability.input,
    callers: capability.callers,
    approval: capability.approval === "always",
    invoke: (ctx: CapabilityContext, raw: unknown): Promise<CapabilityOutput<unknown>> =>
      invoke(capability, ctx, raw),
  };
}
