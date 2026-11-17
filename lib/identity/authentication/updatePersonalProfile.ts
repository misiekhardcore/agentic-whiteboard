import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { isHttpUrl } from "@/lib/shared/url";

import { auth } from "../better-auth";

import { authErrorMessage } from "./authErrorMessage";

/** The person's own name and photo. The account and the email are not editable. */
export async function updatePersonalProfile({
  name,
  image,
  headers,
}: {
  name: string;
  image: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  const trimmedName = name.trim();
  const trimmedImage = image.trim();

  if (!trimmedName) return failure("Add your name.");
  if (trimmedImage && !isHttpUrl(trimmedImage)) {
    return failure("Photo URL must start with http:// or https://.");
  }

  try {
    await auth.api.updateUser({
      body: { name: trimmedName, image: trimmedImage || null },
      headers,
    });
  } catch (error) {
    return failure(authErrorMessage(error, "Could not save your profile. Try again."));
  }

  return null;
}
