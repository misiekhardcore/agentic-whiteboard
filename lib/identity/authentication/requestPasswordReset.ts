import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import { auth } from "../better-auth";

import { authErrorMessage } from "./authErrorMessage";
import { appUrl } from "./internals";

export async function requestPasswordReset({
  email,
}: {
  email: string;
}): Promise<CapabilityFailure | null> {
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${appUrl()}/reset-password` },
    });
  } catch (error) {
    return failure(authErrorMessage(error, "Could not send the reset link. Try again."));
  }

  return null;
}
