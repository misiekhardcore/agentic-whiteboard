import { getActiveSubscription } from "./getActiveSubscription";
import type { SubscriptionRow } from "./types";

/** The subscription that pays for an organization, when there is one. */
export async function getOrganizationSubscription(
  organizationId: string,
): Promise<SubscriptionRow | null> {
  return getActiveSubscription("ORGANIZATION", organizationId);
}
