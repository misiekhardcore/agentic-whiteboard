import { APIError } from "better-auth/api";

import { appOrigin, auth } from "./auth";
import { authErrorMessage } from "./authErrorMessage";
import { clientIp } from "./clientIp";
import { createSlidingWindowLimiter } from "./rateLimit";

export type AuthResult = { ok: true } | { ok: false; error: string };

const FIFTEEN_MINUTES = 15 * 60 * 1_000;
const HOUR = 60 * 60 * 1_000;

/**
 * Attempts are limited per address and per IP: an address budget slows one
 * account's guesser, and the IP budget slows one host walking many addresses.
 * Every refusal names the wait, so the form never fails silently.
 */
const addressSignIn = createSlidingWindowLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });
const ipSignIn = createSlidingWindowLimiter({ limit: 20, windowMs: FIFTEEN_MINUTES });
const addressSignUp = createSlidingWindowLimiter({ limit: 5, windowMs: HOUR });
const ipSignUp = createSlidingWindowLimiter({ limit: 10, windowMs: HOUR });
const addressReset = createSlidingWindowLimiter({ limit: 3, windowMs: FIFTEEN_MINUTES });
const ipReset = createSlidingWindowLimiter({ limit: 10, windowMs: FIFTEEN_MINUTES });

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function spend(
  attempts: { limiter: ReturnType<typeof createSlidingWindowLimiter>; key: string }[],
  now: number,
): AuthResult | null {
  for (const attempt of attempts) {
    const result = attempt.limiter.check(attempt.key, now);
    if (!result.allowed) {
      const wait =
        result.retryAfterSeconds >= 60
          ? `${Math.ceil(result.retryAfterSeconds / 60)} minute(s)`
          : `${result.retryAfterSeconds} second(s)`;
      return { ok: false, error: `Too many attempts. Try again in ${wait}.` };
    }
  }

  return null;
}

function codeOf(error: unknown): string | undefined {
  if (!(error instanceof APIError)) return undefined;
  const body: unknown = error.body;
  if (typeof body !== "object" || body === null || !("code" in body)) return undefined;
  const code = body.code;
  return typeof code === "string" ? code : undefined;
}

function refusal(error: unknown, fallback: string): AuthResult {
  console.error(
    "[identity] authentication call failed:",
    error instanceof Error ? error.message : error,
  );
  return { ok: false, error: authErrorMessage(codeOf(error), fallback) };
}

export async function signIn({
  email,
  password,
  headers,
  now = Date.now(),
}: {
  email: string;
  password: string;
  headers: Headers;
  now?: number;
}): Promise<AuthResult> {
  const limited = spend(
    [
      { limiter: addressSignIn, key: `email:${normalizedEmail(email)}` },
      { limiter: ipSignIn, key: `ip:${clientIp(headers)}` },
    ],
    now,
  );
  if (limited !== null) return limited;

  try {
    await auth.api.signInEmail({ body: { email: normalizedEmail(email), password }, headers });
  } catch (error) {
    return refusal(error, "Could not sign you in. Try again.");
  }

  return { ok: true };
}

export async function signUp({
  name,
  email,
  password,
  headers,
  now = Date.now(),
}: {
  name: string;
  email: string;
  password: string;
  headers: Headers;
  now?: number;
}): Promise<AuthResult> {
  const limited = spend(
    [
      { limiter: addressSignUp, key: `email:${normalizedEmail(email)}` },
      { limiter: ipSignUp, key: `ip:${clientIp(headers)}` },
    ],
    now,
  );
  if (limited !== null) return limited;

  try {
    // Auto sign-in is better-auth's default: the person lands signed in, in
    // their new personal account.
    await auth.api.signUpEmail({
      body: { name: name.trim(), email: normalizedEmail(email), password },
      headers,
    });
  } catch (error) {
    return refusal(error, "Could not create your account. Try again.");
  }

  return { ok: true };
}

export async function requestPasswordReset({
  email,
  headers,
  now = Date.now(),
}: {
  email: string;
  headers: Headers;
  now?: number;
}): Promise<AuthResult> {
  const limited = spend(
    [
      { limiter: addressReset, key: `email:${normalizedEmail(email)}` },
      { limiter: ipReset, key: `ip:${clientIp(headers)}` },
    ],
    now,
  );
  if (limited !== null) return limited;

  try {
    // Answering the same whether or not the address exists is the point: this
    // endpoint must not become an account-existence oracle.
    await auth.api.requestPasswordReset({
      body: { email: normalizedEmail(email), redirectTo: `${appOrigin()}/reset-password` },
      headers,
    });
  } catch (error) {
    return refusal(error, "Could not send the reset link. Try again.");
  }

  return { ok: true };
}

export async function resetPassword({
  token,
  password,
  now = Date.now(),
}: {
  token: string;
  password: string;
  now?: number;
}): Promise<AuthResult> {
  // A reset link is single-use and expires; the token itself is the key here so
  // one address cannot be walked from a single form.
  const limited = spend([{ limiter: addressReset, key: `reset:${token}` }], now);
  if (limited !== null) return limited;

  try {
    await auth.api.resetPassword({ body: { newPassword: password, token } });
  } catch (error) {
    return refusal(error, "Could not reset your password. Try again.");
  }

  return { ok: true };
}

export async function signOut({ headers }: { headers: Headers }): Promise<void> {
  await auth.api.signOut({ headers });
}
