import { entitlementsFor } from "./internals";
import type { Entitlements } from "./types";

export function getUserEntitlements(userId: string): Promise<Entitlements> {
  return entitlementsFor("USER", userId);
}
