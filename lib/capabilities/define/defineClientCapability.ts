import type { ClientCapability } from "./types";

export function defineClientCapability<I>(capability: ClientCapability<I>): ClientCapability<I> {
  return capability;
}
