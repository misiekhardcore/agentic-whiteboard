import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import { auth } from "../better-auth";

import { authErrorMessage } from "./authErrorMessage";

export async function signIn({
  email,
  password,
  headers,
}: {
  email: string;
  password: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  try {
    await auth.api.signInEmail({ body: { email, password }, headers });
  } catch (error) {
    return failure(authErrorMessage(error, "Could not sign you in. Try again."));
  }

  return null;
}
