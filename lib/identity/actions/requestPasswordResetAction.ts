"use server";

import { formString } from "@/lib/shared/form-data";

import { requestPasswordReset } from "../authentication";
import { type AuthFormState, initialAuthState } from "../forms";

export async function requestPasswordResetAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = formString(formData, "email").trim();

  if (!email) return { error: "Enter the email address for your account." };

  const refusal = await requestPasswordReset({ email });
  if (refusal) return { error: refusal.error, values: { email } };

  // Same answer whether or not the address exists, so this cannot be used to
  // discover registered emails.
  return {
    ...initialAuthState,
    notice: "If that email has an account, a reset link is on its way.",
  };
}
