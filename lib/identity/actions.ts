"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { action } from "@/lib/capabilities/action";
import { formString } from "@/lib/shared/form-data";
import { routes } from "@/lib/shared/routes";

import {
  INVALID_TOKEN_MESSAGE,
  isOAuthProvider,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUp,
  startProviderSignIn,
} from "./authentication";
import { setReadAloud, setReadAloudVoice, updatePersonalProfile } from "./capabilities";
import { type AuthFormState, initialAuthState, type ProfileFormState } from "./forms";
import { DEFAULT_REDIRECT, safeRedirectTo } from "./redirect";

/**
 * The pre-auth entry points, and the personal profile.
 *
 * Sign-in cannot be a capability: a capability is invoked with an authenticated
 * actor, and there is nobody to authorize before the session exists. These stay
 * thin actions over `authentication.ts`, which owns the policy they share.
 */

const saveProfile = action(updatePersonalProfile);
const saveReadAloud = action(setReadAloud);
const saveReadAloudVoicePreference = action(setReadAloudVoice);

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

export async function signInWithProviderAction(formData: FormData): Promise<void> {
  const provider = formString(formData, "provider");
  const redirectTo = safeRedirectTo(formData.get("redirectTo")) ?? DEFAULT_REDIRECT;

  if (!isOAuthProvider(provider)) {
    redirect(`${routes.signIn}?error=invalid_provider`);
  }

  const { url } = await startProviderSignIn({ provider, redirectTo, headers: await headers() });

  redirect(url ?? `${routes.signIn}?error=oauth`);
}

export async function signOutAction(): Promise<void> {
  await signOut({ headers: await headers() });
  redirect(routes.signIn);
}

export async function updatePersonalProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const output = await saveProfile(formData);
  if (!output.ok) return { error: output.error };

  return { error: null, notice: "Your profile was updated." };
}

/**
 * The read aloud toggle. The composer applies the choice optimistically, so a
 * refusal comes back as a value for it to revert the button and explain.
 */
export async function setReadAloudAction(enabled: boolean) {
  return saveReadAloud({ enabled });
}

/**
 * The voice choice. Like the toggle it applies as soon as it is picked, so a
 * refusal comes back as a value for the picker to revert.
 */
export async function setReadAloudVoiceAction(voice: string) {
  return saveReadAloudVoicePreference({ voice });
}
