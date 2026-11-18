import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";

import { organizationErrorMessage } from "../errors";
import { uniqueOrganizationSlug } from "../slugs";

export async function createOrganization({
  name,
  headers,
}: {
  name: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  if (!name.trim()) return failure("Name your organization.");

  try {
    await auth.api.createOrganization({
      body: { name: name.trim(), slug: uniqueOrganizationSlug(name) },
      headers,
    });
  } catch (error) {
    return failure(
      organizationErrorMessage(error, "Could not create the organization. Try again."),
    );
  }

  return null;
}
