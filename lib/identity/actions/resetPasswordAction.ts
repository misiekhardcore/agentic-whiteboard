"use server";

import { redirect } from "next/navigation";

import { formString } from "@/lib/shared/form-data";
import { routes } from "@/lib/shared/routes";

import { INVALID_TOKEN_MESSAGE, resetPassword } from "../authentication";
import { type AuthFormState } from "../forms";

export async function resetPasswordAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = formString(formData, "token");
  const password = formString(formData, "password");

  if (!token) return { error: INVALID_TOKEN_MESSAGE };
  if (!password) return { error: "Choose a new password." };

  const refusal = await resetPassword({ token, password });
  if (refusal) return { error: refusal.error };

  redirect(`${routes.signIn}?reset=1`);
}
