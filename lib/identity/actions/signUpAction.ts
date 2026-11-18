"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { formString } from "@/lib/shared/form-data";

import { signUp } from "../authentication";
import { type AuthFormState } from "../forms";
import { DEFAULT_REDIRECT, safeRedirectTo } from "../redirect";

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = formString(formData, "name").trim();
  const email = formString(formData, "email").trim();
  const password = formString(formData, "password");
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  if (!name || !email || !password) {
    return { error: "Fill in your name, email, and password.", values: { name, email } };
  }

  const refusal = await signUp({ name, email, password, headers: await headers() });
  if (refusal) return { error: refusal.error, values: { name, email } };

  redirect(redirectTo ?? DEFAULT_REDIRECT);
}
