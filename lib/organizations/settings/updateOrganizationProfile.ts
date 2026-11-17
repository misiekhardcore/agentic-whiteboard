import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { auth } from "@/lib/identity/better-auth";
import { isHttpUrl } from "@/lib/shared/url";

import { organizationErrorMessage } from "../errors";
import { canManageTeam } from "../membership";
import { getMemberRole } from "../queries";
import { normalizeOrganizationSlug } from "../slugs";

/**
 * Editing the organization's own profile. The caller's role is checked here,
 * not in the form: the dialog disables the fields for a member, and the server
 * is what actually refuses them.
 */
export async function updateOrganizationProfile({
  userId,
  organizationId,
  name,
  slug,
  logo,
  headers,
}: {
  userId: string;
  organizationId: string;
  name: string;
  slug: string;
  logo: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  const trimmedName = name.trim();
  const normalizedSlug = normalizeOrganizationSlug(slug);
  const trimmedLogo = logo.trim();

  if (!trimmedName) return failure("Add an organization name.");
  if (!normalizedSlug) return failure("Add an organization URL.");
  if (trimmedLogo && !isHttpUrl(trimmedLogo)) {
    return failure("Logo URL must start with http:// or https://.");
  }

  const role = await getMemberRole(organizationId, userId);
  if (!role || !canManageTeam(role)) {
    return failure("Only owners and admins can edit the organization profile.");
  }

  try {
    await auth.api.updateOrganization({
      body: {
        organizationId,
        data: { name: trimmedName, slug: normalizedSlug, logo: trimmedLogo || null },
      },
      headers,
    });
  } catch (error) {
    return failure(
      organizationErrorMessage(error, "Could not save the organization profile. Try again."),
    );
  }

  return null;
}
