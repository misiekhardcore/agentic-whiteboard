"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { AuthFormState } from "@/lib/auth-form";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  USER_ALREADY_EXISTS: "An account with this email already exists.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with this email already exists.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long.",
};

/**
 * Turns a better-auth error into a sentence a person can act on. Codes we do
 * not know fall back to the generic message so internal details stay on the
 * server.
 */
function toMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const code = error.body?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
  }
  return fallback;
}

export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", values: { email } };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (error) {
    return {
      error: toMessage(error, "Could not sign you in. Try again."),
      values: { email },
    };
  }

  redirect("/dashboard");
}

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return {
      error: "Fill in your name, email, and password.",
      values: { name, email },
    };
  }

  try {
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
  } catch (error) {
    return {
      error: toMessage(error, "Could not create your account. Try again."),
      values: { name, email },
    };
  }

  redirect("/dashboard");
}
