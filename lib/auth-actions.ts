"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { AuthFormState } from "@/lib/auth-form";
import { DEFAULT_REDIRECT, safeRedirectTo } from "@/lib/auth-redirect";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  USER_ALREADY_EXISTS: "An account with this email already exists.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with this email already exists.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long.",
  INVALID_TOKEN: "That link is invalid or has expired. Request a new one.",
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
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

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

  redirect(redirectTo ?? DEFAULT_REDIRECT);
}

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

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

  redirect(redirectTo ?? DEFAULT_REDIRECT);
}

export async function requestPasswordResetAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter the email address for your account." };
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/reset-password`,
      },
    });
  } catch (error) {
    return {
      error: toMessage(error, "Could not send the reset link. Try again."),
      values: { email },
    };
  }

  // Same answer whether or not the address exists, so this cannot be used to
  // discover registered emails.
  return {
    error: null,
    notice: "If that email has an account, a reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!token) {
    return { error: MESSAGES.INVALID_TOKEN };
  }

  if (!password) {
    return { error: "Choose a new password." };
  }

  try {
    await auth.api.resetPassword({ body: { newPassword: password, token } });
  } catch (error) {
    return { error: toMessage(error, "Could not reset your password. Try again.") };
  }

  redirect("/sign-in?reset=1");
}

const OAUTH_PROVIDERS = ["github", "google"] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Starts an OAuth flow. Better Auth returns the provider's authorize URL and
 * stores the state/PKCE cookies through the nextCookies plugin, so all this
 * action has to do is send the browser there.
 */
export async function signInWithProviderAction(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "");
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  if (!isOAuthProvider(provider)) {
    redirect("/sign-in?error=invalid_provider");
  }

  let url: string | undefined;
  try {
    const result = await auth.api.signInSocial({
      body: {
        provider,
        callbackURL: redirectTo ?? DEFAULT_REDIRECT,
        // Better Auth appends ?error=<code> when the provider rejects or the
        // callback fails, so the sign-in page can explain what happened.
        errorCallbackURL: "/sign-in",
      },
      headers: await headers(),
    });
    url = result.url;
  } catch (error) {
    console.error(`[auth] ${provider} sign-in could not start:`, error);
  }

  redirect(url ?? "/sign-in?error=oauth");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
