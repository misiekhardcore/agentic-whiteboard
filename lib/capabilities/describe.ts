import {
  type Capability,
  type CapabilityContext,
  type CapabilityDescriptor,
  type CapabilityOutput,
  type ClientCapability,
  type ToolPresentation,
} from "./define";
import { invoke } from "./invoke";

/**
 * Widening a capability for the registry, the tool catalog and the thread. The
 * registry is the only consumer, so the casting stays here instead of at every
 * call site that only needs the surface.
 */

function presentation<I>(
  present: ((input: I) => ToolPresentation) | undefined,
): ((input: unknown) => ToolPresentation) | undefined {
  return present ? (input: unknown) => present(input as I) : undefined;
}

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
