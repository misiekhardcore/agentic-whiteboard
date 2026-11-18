"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { formString } from "@/lib/shared/form-data";

import { signIn } from "../authentication";
import { type AuthFormState } from "../forms";
import { DEFAULT_REDIRECT, safeRedirectTo } from "../redirect";

export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = formString(formData, "email").trim();
  const password = formString(formData, "password");
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  if (!email || !password) {
    return { error: "Enter your email and password.", values: { email } };
  }

  const refusal = await signIn({ email, password, headers: await headers() });
  if (refusal) return { error: refusal.error, values: { email } };

  redirect(redirectTo ?? DEFAULT_REDIRECT);
}
