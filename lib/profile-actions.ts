"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { canManageTeam, getMemberRole } from "@/lib/organizations";
import type { ProfileFormState } from "@/lib/profile-form";
import { routes, signInPath } from "@/lib/routes";

const ORGANIZATION_MESSAGES: Record<string, string> = {
  ORGANIZATION_NOT_FOUND: "That organization no longer exists.",
  ORGANIZATION_SLUG_ALREADY_TAKEN:
    "That URL is already taken. Pick a different one.",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION:
    "Only owners and admins can edit the organization profile.",
  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION:
    "You are no longer a member of that organization.",
};

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const code = error.body?.code;
    if (code && ORGANIZATION_MESSAGES[code]) return ORGANIZATION_MESSAGES[code];
    if (error.body?.message) return error.body.message;
  }
  return fallback;
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(signInPath(routes.dashboardSettings));
  return session;
}

/** An uploaded file would be better, but the app has no storage yet. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function updatePersonalProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const image = String(formData.get("image") ?? "").trim();

  if (!name) return { error: "Add your name." };
  if (image && !isHttpUrl(image)) {
    return { error: "Photo URL must start with http:// or https://." };
  }

  try {
    await auth.api.updateUser({
      body: { name, image: image || null },
      headers: await headers(),
    });
  } catch (error) {
    return {
      error: toMessage(error, "Could not save your profile. Try again."),
    };
  }

  // The header avatar and account menu show the name and photo.
  revalidatePath("/", "layout");
  return { error: null, notice: "Your profile was updated." };
}

export async function updateOrganizationProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const logo = String(formData.get("logo") ?? "").trim();

  if (!organizationId) {
    return { error: "That organization could not be found." };
  }
  if (!name) return { error: "Add an organization name." };
  if (!slug) return { error: "Add an organization URL." };
  if (logo && !isHttpUrl(logo)) {
    return { error: "Logo URL must start with http:// or https://." };
  }

  const callerRole = await getMemberRole(organizationId, session.user.id);
  if (!callerRole || !canManageTeam(callerRole)) {
    return { error: "Only owners and admins can edit the organization profile." };
  }

  try {
    await auth.api.updateOrganization({
      body: {
        organizationId,
        data: { name, slug, logo: logo || null },
      },
      headers: await headers(),
    });
  } catch (error) {
    return {
      error: toMessage(
        error,
        "Could not save the organization profile. Try again.",
      ),
    };
  }

  revalidatePath("/", "layout");
  return { error: null, notice: "The organization profile was updated." };
}
