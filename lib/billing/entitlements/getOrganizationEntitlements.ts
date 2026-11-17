import { entitlementsFor } from "./internals";
import type { Entitlements } from "./types";

export function getOrganizationEntitlements(organizationId: string): Promise<Entitlements> {
  return entitlementsFor("ORGANIZATION", organizationId);
}
