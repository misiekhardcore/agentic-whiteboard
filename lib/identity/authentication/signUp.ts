import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import { auth } from "../better-auth";

import { authErrorMessage } from "./authErrorMessage";

export async function signUp({
  name,
  email,
  password,
  headers,
}: {
  name: string;
  email: string;
  password: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  try {
    await auth.api.signUpEmail({ body: { name, email, password }, headers });
  } catch (error) {
    return failure(authErrorMessage(error, "Could not create your account. Try again."));
  }

  return null;
}
