import type { Capability } from "@v2/contracts";

import type { CapabilityContext } from "./context";

export type AppCapability<Input, Output extends object, Resource> = Capability<
  CapabilityContext,
  Input,
  Output,
  Resource
>;

/** Identity at runtime; it exists to infer the input, output and row types. */
export function defineCapability<Input, Output extends object, Resource = undefined>(
  capability: AppCapability<Input, Output, Resource>,
): AppCapability<Input, Output, Resource> {
  return capability;
}
