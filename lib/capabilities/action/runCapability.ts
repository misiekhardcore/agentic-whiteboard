import { type Capability, type CapabilityOutput } from "../define";
import { invoke } from "../invoke";

import { humanContext } from "./humanContext";
import { readInput } from "./internals";

/** Runs a capability for the signed-in person; nothing is revalidated here. */
export async function runCapability<I, T, R>(
  capability: Capability<I, T, R>,
  raw: unknown,
): Promise<CapabilityOutput<T>> {
  return invoke(capability, await humanContext(), readInput(raw));
}
