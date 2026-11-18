import { auth } from "@/lib/identity/better-auth";
import { canManageTeam } from "@/lib/organizations/membership";
import { getMemberRole } from "@/lib/organizations/queries";
import { uniqueOrganizationSlug } from "@/lib/organizations/slugs";

import { BillingRequestError } from "../stripe";

export const MAX_SEATS = 500;

export function clampSeats(value: unknown): number {
  const seats = Math.floor(Number(value));
  if (!Number.isFinite(seats) || seats < 1) return 1;
  return Math.min(seats, MAX_SEATS);
}

export /**
 * Picks the organization a team plan bills. An explicit id must belong to the
 * caller with a billing role; a name creates a new organization (the pricing
 * sheet offers this when someone has no team yet). Without either, checkout is
 * refused: the personal account is a valid selection, so the server must not
 * guess an organization on the caller's behalf.
 */
async function resolveTeamOrganization({
  userId,
  organizationId,
  organizationName,
  headers,
}: {
  userId: string;
  organizationId?: unknown;
  organizationName?: unknown;
  headers: Headers;
}): Promise<string> {
  if (typeof organizationId === "string" && organizationId) {
    const role = await getMemberRole(organizationId, userId);

    if (!role) {
      throw new BillingRequestError("You are not a member of that organization.", 403);
    }
    if (!canManageTeam(role)) {
      throw new BillingRequestError("Only organization owners and admins can manage billing.", 403);
    }

    return organizationId;
  }

  const name = typeof organizationName === "string" ? organizationName.trim() : "";
  if (name) {
    const created = await auth.api.createOrganization({
      body: {
        name,
        slug: uniqueOrganizationSlug(name),
        keepCurrentActiveOrganization: true,
      },
      headers,
    });
    if (!created?.id) {
      throw new BillingRequestError("Could not create the organization.", 502);
    }
    return created.id;
  }

  throw new BillingRequestError("Choose an organization before starting a team plan.", 400);
}
