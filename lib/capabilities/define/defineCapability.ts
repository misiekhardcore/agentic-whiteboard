import type { Capability } from "./types";

export function defineCapability<I, T, R = undefined>(
  capability: Capability<I, T, R>,
): Capability<I, T, R> {
  return capability;
}
