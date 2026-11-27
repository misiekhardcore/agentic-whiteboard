"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { routes, signInPath } from "@/src/routes";
import {
  requestPasswordReset,
  resetPassword,
  signIn,
  signUp,
} from "@/src/server/identity/authentication";
import { type AuthFormState } from "@/src/server/identity/formState";
import { isOAuthProvider, startProviderSignIn } from "@/src/server/identity/providerSignIn";
import { safeRedirectTo } from "@/src/server/identity/safeRedirectTo";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  if (!email || !password) {
    return { error: "Enter your email and password.", values: { email } };
  }

  const result = await signIn({ email, password, headers: await headers() });
  if (!result.ok) return { error: result.error, values: { email } };

  redirect(redirectTo ?? routes.home);
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = field(formData, "name").trim();
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  if (!name || !email || !password) {
    return { error: "Fill in your name, email, and password.", values: { name, email } };
  }

  const result = await signUp({ name, email, password, headers: await headers() });
  if (!result.ok) return { error: result.error, values: { name, email } };

  redirect(redirectTo ?? routes.home);
}

export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();

  if (!email) return { error: "Enter your email address.", values: { email } };

  const result = await requestPasswordReset({ email, headers: await headers() });
  if (!result.ok) return { error: result.error, values: { email } };

  return {
    error: null,
    notice: "If that address has an account, a reset link is on its way.",
    values: { email },
  };
}

export async function resetPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = field(formData, "token");
  const password = field(formData, "password");

  if (!token) return { error: "That link is invalid or has expired. Request a new one." };
  if (!password) return { error: "Enter a new password." };

  const result = await resetPassword({ token, password });
  if (!result.ok) return { error: result.error };

  redirect(signInPath());
}

/** Sends the browser to the provider, or back to sign-in with one sentence. */
export async function startOAuthAction(formData: FormData): Promise<void> {
  const provider = field(formData, "provider");
  const redirectTo = safeRedirectTo(formData.get("redirectTo")) ?? routes.home;

  if (!isOAuthProvider(provider)) redirect(signInPath());

  const result = await startProviderSignIn({
    provider,
    redirectTo,
    headers: await headers(),
  });

  if (result.url === undefined) {
    redirect(`${signInPath()}?error=provider`);
  }

  redirect(result.url);
}
