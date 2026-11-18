import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import { auth } from "../better-auth";

import { authErrorMessage } from "./authErrorMessage";

export async function resetPassword({
  token,
  password,
}: {
  token: string;
  password: string;
}): Promise<CapabilityFailure | null> {
  try {
    await auth.api.resetPassword({ body: { newPassword: password, token } });
  } catch (error) {
    return failure(authErrorMessage(error, "Could not reset your password. Try again."));
  }

  return null;
}
