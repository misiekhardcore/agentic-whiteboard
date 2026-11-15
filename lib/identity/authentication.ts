import { APIError } from "better-auth/api";

import { type CapabilityFailure, failure } from "@/lib/capabilities/define";
import { isHttpUrl } from "@/lib/shared/url";

import { auth } from "./better-auth";

/**
 * Sign-in, sign-up, reset and the person's own profile.
 *
 * These run before (or outside) any capability: there is no actor to
 * authorize, so they are plain application functions and the actions above them
 * stay thin. What is policy still lives here once: the error code → sentence
 * mapping, the reset link, and the profile's field rules.
 */

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  USER_ALREADY_EXISTS: "An account with this email already exists.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long.",
  INVALID_TOKEN: "That link is invalid or has expired. Request a new one.",
};

/** A sentence a person can act on; unknown codes keep the caller's fallback. */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const code = error.body?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
  }

  return fallback;
}

export const INVALID_TOKEN_MESSAGE = MESSAGES.INVALID_TOKEN;

function appUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

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

export async function requestPasswordReset({
  email,
}: {
  email: string;
}): Promise<CapabilityFailure | null> {
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${appUrl()}/reset-password` },
    });
  } catch (error) {
    return failure(authErrorMessage(error, "Could not send the reset link. Try again."));
  }

  return null;
}

export async function resetPassword({
  token,
  password,
}: {
  token: string;
  password: string;
}): Promise<CapabilityFailure | null> {
  try {
    await auth.api.resetPassword({ body: { newPassword: password, token } });
  } catch (error) {
    return failure(authErrorMessage(error, "Could not reset your password. Try again."));
  }

  return null;
}

const OAUTH_PROVIDERS = ["github", "google"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Starts an OAuth flow. Better Auth returns the provider's authorize URL and
 * stores the state/PKCE cookies through the nextCookies plugin, so the caller
 * only has to send the browser there.
 */
export async function startProviderSignIn({
  provider,
  redirectTo,
  headers,
}: {
  provider: OAuthProvider;
  redirectTo: string;
  headers: Headers;
}): Promise<{ url?: string }> {
  try {
    const result = await auth.api.signInSocial({
      body: {
        provider,
        callbackURL: redirectTo,
        // Better Auth appends ?error=<code> when the provider rejects or the
        // callback fails, so the sign-in page can explain what happened.
        errorCallbackURL: "/sign-in",
      },
      headers,
    });

    return { url: result.url };
  } catch (error) {
    console.error(`[identity] ${provider} sign-in could not start:`, error);
    return {};
  }
}

export async function signOut({ headers }: { headers: Headers }): Promise<void> {
  await auth.api.signOut({ headers });
}

/** The person's own name and photo. The account and the email are not editable. */
export async function updatePersonalProfile({
  name,
  image,
  headers,
}: {
  name: string;
  image: string;
  headers: Headers;
}): Promise<CapabilityFailure | null> {
  const trimmedName = name.trim();
  const trimmedImage = image.trim();

  if (!trimmedName) return failure("Add your name.");
  if (trimmedImage && !isHttpUrl(trimmedImage)) {
    return failure("Photo URL must start with http:// or https://.");
  }

  try {
    await auth.api.updateUser({
      body: { name: trimmedName, image: trimmedImage || null },
      headers,
    });
  } catch (error) {
    return failure(authErrorMessage(error, "Could not save your profile. Try again."));
  }

  return null;
}
